//const puppeteer = require('puppeteer');
const chromium = require('chrome-aws-lambda');
const dayjs = require('dayjs')
const customParseFormat = require('dayjs/plugin/customParseFormat')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)
const IS_OFFLINE = process.env.IS_OFFLINE;

const q = require('./queue.js');
const notif = require('./notify.js')

const startBooking = {
    'daysBefore': 3,
    'timeReleasedHr': 9,
    'timeReleasedMin': 0,
    'minsBeforeRelease': 5,
    'retryTimeoutMins': 1
}

const urls = {
    'stafflogin': 'https://clients.mindbodyonline.com/classic/ws?studioid=739798',
    'notstaff': 'https://clients.mindbodyonline.com/ASP/home.asp?studioid=739798',
    'classes': 'https://clients.mindbodyonline.com/classic/mainclass?fl=true&tabID=7',
    'homeredir': 'https://clients.mindbodyonline.com/ASP/su1.asp?studioid=739798&tg=&vt=&lvl=&stype=&view=&trn=0&page=&catid=&prodid=&date=11%2f13%2f2021&classid=0&prodGroupId=&sSU=&optForwardingLink=&qParam=&justloggedin=&nLgIn=&pMode=0&loc=1'
}


async function getClasses(formattedDate) {
    //Formatted date is in MBO format i.e. 1/1/2022 or 12/12/2022

    let chromiumArgs
    
    if (IS_OFFLINE === 'true') {
        chromiumArgs = {
            headless: true,
            ignoreHTTPSErrors: true
        }
    } else {
        chromiumArgs = {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true
        }
    }

    const browser = await chromium.puppeteer.launch(chromiumArgs)
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36')
    await page.goto(urls.notstaff);
    await page.waitForSelector('#tabA7', { visible: true, timeout: 10000 })
    await page.click('#tabA7')
    await page.waitForSelector('#classSchedule-mainTable', { visible: true, timeout: 10000 })
    console.log('Page loaded')

    const defaultDate = await page.evaluate(() => document.querySelector('#txtDate').value)

    console.log('Default date on MBO is ', defaultDate)
    console.log('Date requested is ', formattedDate)
    if (defaultDate !== formattedDate) {
        console.log('Selecting new date...')
        await page.evaluate((formattedDate) => { document.querySelector('#txtDate').value = formattedDate }, formattedDate)
        await page.focus('#txtDate')
        await page.keyboard.press('Enter')
        await page.waitForSelector('#classSchedule-mainTable', { visible: true, timeout: 10000 })
        console.log('Page loaded')
    }

    // Table includes all classes starting from the previous Monday
    const classTableHTML = await page.evaluate(() => document.querySelector('#classSchedule-mainTable').outerHTML)
    const tableRows = classTableHTML.split('</tr>')
    console.log(tableRows.length, 'records fetched')
    await browser.close();
    return processClassTable(tableRows)
}

/*function checkBookingValidity(bookingDetails) {
    const b = bookingDetails
    console.log('Checking validity for ', b)
    let startAfter = dayjs(b.parsedDT).subtract(startBooking.daysBefore, 'days').hour(startBooking.timeReleasedHr).minute(startBooking.timeReleasedMin).subtract(startBooking.minsBeforeRelease, 'minutes')
    console.log('checking if now is after ', startAfter.tz('Asia/Singapore').format())
    if (dayjs().isBefore(startAfter)) {
        throw Error('Too early to book.')
    } else if (dayjs().isAfter(b.parsedDT)) {
        updateNidStatus(nid, 'EXPIRED')
        removeFromQueue(nid)
        throw Error('Class already started.')
    } else {
        return 'Valid'
    }
}*/

async function book(bookingDetails) {
    const b = bookingDetails
    console.log('begin booking for ', b, 'at', dayjs().format())

    const retryUntil = dayjs().add(startBooking.retryTimeoutMins,'minutes')

    let chromiumArgs
    
    if (IS_OFFLINE === 'true') {
        chromiumArgs = {
            headless: true,
            ignoreHTTPSErrors: true
        }
    } else {
        chromiumArgs = {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true
        }
    }

    const browser = await chromium.puppeteer.launch(chromiumArgs)
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36')
    await page.goto(urls.notstaff);
    console.log('waiting for selector')
    await page.waitForSelector('#su1UserName', { visible: true, timeout: 10000 })
    console.log('username box there')
    await page.evaluate((b) => { document.querySelector('#su1UserName').value = b.mboUsername }, b)
    await page.evaluate((b) => { document.querySelector('#su1Password').value = b.mboPassword }, b)
    console.log('username entered')
    await page.click('#btnSu1Login')
    console.log('button clicked')
    const loginPromises = [
        page.waitForSelector('#btnLogout', { visible: true, timeout: 10000}),
        page.waitForSelector('#LoginError', { visible: true, timeout: 10000})
    ]
    await Promise.race(loginPromises)
    const loginError = await page.evaluate(() => document.querySelector('#LoginError')?.textContent)
    if ( loginError === "The email or password you entered is incorrect.") {
        q.updateNidStatus(b.nid, 'INVALID CREDENTIALS')
        q.removeFromQueue(b.nid)
        b.pStatus = 'INVALID CREDENTIALS'
        notif.failed(b)
        await browser.close();
        return null
    }
    console.log('login action completed')
    await page.click('#tabA7')
    console.log('tab clicked')
    await page.waitForSelector('#classSchedule-mainTable', { visible: true, timeout: 10000 })
    const defaultDate = await page.evaluate(() => document.querySelector('#txtDate').value)
    console.log('Default date on MBO is ', defaultDate)
    console.log('Date requested is ', b.parsedDT)
    
    let classTableHTML = await page.evaluate(() => document.querySelector('#classSchedule-mainTable').outerHTML)
    let tableRows = classTableHTML.split('</tr>')
    console.log(tableRows.length, 'records fetched')
      
    let classes = processClassTable(tableRows)
    console.log('found classes')
    let dateFound

    for (let thisClass of classes) {
        console.log('checking ', thisClass)
        if (b.classDate === thisClass.date) {
            console.log('classes for this date are in the default page')
            dateFound = true
        } else {
            console.log(b.classDate, "not equal to", thisClass.date)
        }
    }
    
    if (!dateFound) {
        let formatparam = dayjs(b.parsedDT).tz('Asia/Singapore').format('DD/MM/YYYY')
        console.log('Selecting new date...',formatparam)
        await page.evaluate((formatparam) => { document.querySelector('#txtDate').value = formatparam }, formatparam)
        await page.focus('#txtDate')
        await page.keyboard.press('Enter')
        await page.waitForSelector('#classSchedule-mainTable', { visible: true, timeout: 10000 })
        console.log('Page reloaded after date change')
        classTableHTML = await page.evaluate(() => document.querySelector('#classSchedule-mainTable').outerHTML)
        tableRows = classTableHTML.split('</tr>')
        classes = processClassTable(tableRows)   
    }

    let matchingClasses = 0
    for (let thisClass of classes) {
        if (b.classDate === thisClass.date && b.className === thisClass.name && b.classTime === thisClass.time) {
            matchingClasses++
            console.log('found a match')
            console.log(thisClass)
        }
    }
    if (matchingClasses < 1) {
        console.log('Class no longer exists')
        q.updateNidStatus(b.nid, 'CLASS NOT FOUND')
        q.removeFromQueue(b.nid)
        b.pStatus='CLASS NOT FOUND'
        notif.failed(b)
        await browser.close();
        return new Promise(reject => {reject(new Error('Class Not Found'))})
    } else if (matchingClasses > 1) {
        console.log('Duplicate classes on page')
        q.updateNidStatus(b.nid, 'DUPLICATE IN MB')
        q.removeFromQueue(b.nid)
        b.pStatus='DUPLICATE IN MB'
        notif.failed(b)
        await browser.close();
        return new Promise(reject => {reject(new Error('Ambiguous classes to book'))})
    }

    while (dayjs().isBefore(retryUntil)) {
        //loop this code until the booking succeeds, fails or times outs
        const classTableHTML = await page.evaluate(() => document.querySelector('#classSchedule-mainTable').outerHTML)
        const tableRows = classTableHTML.split('</tr>')
        console.log(tableRows.length, 'records fetched')
        
        let classes = processClassTable(tableRows)

        for (let thisClass of classes) {
            if (b.classDate === thisClass.date && b.className === thisClass.name && b.classTime === thisClass.time) {
                console.log('found the class on the page', thisClass)
                if (!thisClass?.id) {
                    console.log('button not found, will retry until',retryUntil.tz('Asia/Singapore').format())
                    q.updateNidStatus(b.nid, 'AWAITING RELEASE')
                    await delay(2000)
                    try {
                        await page.reload()
                        await page.waitForSelector('#classSchedule-mainTable', { visible: true, timeout: 10000 })
                        console.log('reloaded page')
                    } catch (e) {
                        console.log('an error occurred during page reload, it happens from time to time.')
                        await page.reload()
                    }
                    
                } else if (thisClass?.slots < 1) {
                    // Slots have recently not been available on MindBodyOnline, so this has not recently been invoking.
                    console.log('no slots for this booking')
                    q.updateNidStatus(b.nid, 'NO SLOTS')
                    q.removeFromQueue(b.nid)
                    b.pStatus = 'NO SLOTS'
                    notif.failed(b)
                    await browser.close();
                    return new Promise(reject => {reject(new Error('No slots available'))})
                } else {
                    console.log('attempting booking')
                    await page.click(`[name="${thisClass.id}"]`)
                    console.log('button clicked')
                    
                    try {
                        const attemptBookingPromises = [
                            page.waitForSelector('#SubmitEnroll2', { visible: true, timeout: 10000}),
                            page.waitForSelector('form[name="frmWaitList"]', { timeout: 10000}),
                            page.waitForSelector('input[name="AddWLButton"]', { visible: true, timeout: 10000})
                        ]
                        await Promise.race(attemptBookingPromises)    
                    } catch (e) {
                        console.log('timeout waiting for a recognizable element after clicking the booking button.')
                        let screenshotPath = b.nid + '-clicked-booking-button.png'
                        await page.screenshot({ path: screenshotPath });
                        console.log('check the screenshot at ', screenshotPath)
                        throw(e)
                    }
                    
                    console.log('one of the promises resolved')
                    let screenshotPath = b.nid + '-clicked-booking-button.png'
                    await page.screenshot({ path: screenshotPath });
                    const isBookable = await page.evaluate(() => document.querySelector('#SubmitEnroll2')?.value)
                    const isWaitlistable = await page.evaluate(() => document.querySelector('input[name="AddWLButton]')?.value)
                    if (isBookable) {
                        await page.click('#SubmitEnroll2')
                        await page.waitForSelector('#notifyBooking', { visible: true, timeout: 10000 })
                        q.updateNidStatus(b.nid, 'CONFIRMED')
                        q.removeFromQueue(b.nid)
                        b.pStatus = 'CONFIRMED'
                        notif.confirmed(b)
                        await browser.close();
                        return new Promise(resolve => {resolve(b.nid)})
                    }
                    
                    if (isWaitlistable) {
                        await page.click('input[name="AddWLButton]')
                        await page.waitForSelector('.myInfoTable', { visible: true, timeout: 10000 })
                        q.updateNidStatus(b.nid, 'WAITLISTED')
                        q.removeFromQueue(b.nid)
                        b.pStatus = 'WAITLISTED'
                        notif.confirmed(b)
                        await browser.close();
                        return new Promise(resolve => {resolve(b.nid)})
                    }
                    
                    if (!isBookable && !isWaitlistable) {
                        console.log('Not able to book or add to waitlist')
                        q.updateNidStatus(b.nid, 'NO BOOKING/WAITLIST')
                        q.removeFromQueue(b.nid)
                        b.pStatus = 'NO BOOKING/WAITLIST'
                        notif.failed(b)
                        await browser.close();
                        return new Promise(reject => {reject(new Error('No booking/waitlist'))})
                    }
                    
                    //Shouldn't reach here...
                    await browser.close();
                    return new Promise(resolve => {resolve(b.nid)})
                }
            }
        }
    }

    console.log('booking button not available after several retries.  item remains on queue and can be retried')
    q.updateNidStatus(b.nid, 'NO BUTTON')
    notif.failed(b, 'NO BUTTON')
    await browser.close();
    return new Promise(reject => {reject(new Error('No booking button available after multiple retries'))})
}

function processClassTable(tableRows) {
    let classes = new Array()
    let strDate
 
    for (let row of tableRows) {
        if (row.includes(`class="headText"`)) {
            //date header row
            let startOfDate = row.indexOf("headText") + 10
            let endOfDate = row.indexOf("</b>")
            let lengthOfDate = endOfDate - startOfDate
            let htmlDate = row.substr(startOfDate, lengthOfDate)
            strDate = htmlDate.replace('&nbsp;', ' ').replace('</span>', '').replace('&nbsp;', '')
            console.log('Processing classes for ', strDate)
        }
        if (row.includes(`class="evenRow"`) || row.includes(`class="oddRow"`)) {
            //class row
            let thisClass = new Object()
            thisClass.date = strDate
            let rowData = row.split('</td>')
            if (rowData.length <= 2) {
                console.log('No classes for ', strDate)
                continue
            }
            //TD0 - time
            let timeStart = rowData[0].indexOf('&nbsp;')
            thisClass.time = rowData[0].substr(timeStart).replace(/&nbsp;/g, '')
            //TD1 - sign-up button & slots inc. ID code
            if (rowData[1].indexOf('Open') !== -1) {
                let slotStart = rowData[1].indexOf(';Open') - 7
                thisClass.slots = parseInt(rowData[1].substr(slotStart, 2).replace(';', ''))
            }
            if (rowData[1].indexOf('name') !== -1) {
                let idStart = rowData[1].indexOf('name') + 6
                thisClass.id = rowData[1].substr(idStart, 7)
            }
            //TD2 - class name
            let classStart = rowData[2].indexOf('c">') + 3
            thisClass.name = rowData[2].substr(classStart).replace('</a>', '').replace('d>', '')
            //TD3 - coach
            let coachEnd = rowData[3].indexOf('<span') - 1
            if (coachEnd > 0) {
                thisClass.coach = rowData[3].substr(0, coachEnd).replace('<td>', '')
            } else {
                thisClass.coach = rowData[3].replace('<td>', '')
            }
            if (rowData[3].indexOf('Cancelled Today') !== -1) {
                thisClass.coach = 'Cancelled Today'
            }
            //TD4 - assistant
            //TD5 - 2nd assistant
            //TD6 - room
            //TD7 - duration
            thisClass.duration = rowData[7].replace('<td>', '').replace(/&nbsp;/g, '')
            classes.push(thisClass)
        }
    }
    console.log('Processed all class rows')
    return classes
 }

 function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

 module.exports = {getClasses, book}
 //module.exports = {checkBookingValidity}