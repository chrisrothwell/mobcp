const puppeteer = require('puppeteer');
const dayjs = require('dayjs')
const customParseFormat = require('dayjs/plugin/customParseFormat')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

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

    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();
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

    return processClassTable(tableRows)
    await browser.close();
}

function checkBookingValidity(bookingDetails) {
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
}

async function book(bookingDetails) {
    const b = bookingDetails
    console.log('begin booking for ', b)

    const retryUntil = dayjs().add(startBooking.retryTimeoutMins,'minutes')

    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();
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
        updateNidStatus(nid, 'INVALID CREDENTIALS')
        removeFromQueue(nid)
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
    const dateHeaders = await page.evaluate(() => {
        const tds = Array.from(document.querySelectorAll('td'))
        return tds.map(td => td.innerText.trim())
    })

    const dateOnPage = dateHeaders.find( (e) => e === b.classDate)
    if (!dateOnPage) {
        let formatparam = dayjs(b.parsedDT).tz('Asia/Singapore').format('DD/MM/YYYY')
        console.log('Selecting new date...',formatparam)
        await page.evaluate((formatparam) => { document.querySelector('#txtDate').value = formatparam }, formatparam)
        await page.focus('#txtDate')
        await page.keyboard.press('Enter')
        await page.waitForSelector('#classSchedule-mainTable', { visible: true, timeout: 10000 })
        console.log('Page loaded')
    }

    const classTableHTML = await page.evaluate(() => document.querySelector('#classSchedule-mainTable').outerHTML)
    const tableRows = classTableHTML.split('</tr>')
    console.log(tableRows.length, 'records fetched')
      
    let classes = processClassTable(tableRows)

    let matchingClasses = 0
    for (thisClass of classes) {
        if (b.classDate === thisClass.date && b.className === thisClass.name && b.classTime === thisClass.time) {
            matchingClasses++
            console.log('found a match')
            console.log(thisClass)
        }
    }
    if (matchingClasses < 1) {
        console.log('Class no longer exists')
        updateNidStatus(nid, 'CLASS NOT FOUND')
        removeFromQueue(nid)
        await browser.close();
        return null
    } else if (matchingClasses > 1) {
        console.log('Duplicate classes on page')
        updateNidStatus(nid, 'DUPLICATE IN MB')
        removeFromQueue(nid)
        await browser.close();
        return null
    }

    while (dayjs().isBefore(retryUntil)) {
        //loop this code until the booking succeeds, fails or times outs
        const classTableHTML = await page.evaluate(() => document.querySelector('#classSchedule-mainTable').outerHTML)
        const tableRows = classTableHTML.split('</tr>')
        console.log(tableRows.length, 'records fetched')
        
        let classes = processClassTable(tableRows)

        for (thisClass of classes) {
            if (b.classDate === thisClass.date && b.className === thisClass.name && b.classTime === thisClass.time) {
                console.log('found the class on the page', thisClass)
                if (!thisClass?.id) {
                    console.log('button not found, will retry until',retryUntil.tz('Asia/Singapore').format())
                    updateNidStatus(nid, 'AWAITING RELEASE')
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
                    console.log('no slots for this booking')
                    updateNidStatus(nid, 'NO SLOTS')
                    removeFromQueue(nid)
                    await browser.close();
                    return null
                } else {
                    console.log('attempting booking')
                    await page.click(`[name="${thisClass.id}"]`)
                    console.log('button clicked')
                    await page.waitForSelector('#SubmitEnroll2', { visible: true, timeout: 10000 })
                    await page.click('#SubmitEnroll2')
                    await page.waitForSelector('#notifyBooking', { visible: true, timeout: 10000 })
                    updateNidStatus(nid, 'CONFIRMED')
                    removeFromQueue(nid)
                    await browser.close();
                    return null
                }
            }
        }
    }

    console.log('timed out, user may retry')
    updateNidStatus(nid, 'TIMEOUT')
    await browser.close();
    return null
}

function processClassTable(tableRows) {
    let classes = new Array()
    let strDate
 
    for (row of tableRows) {
        if (row.includes(`class="headText"`)) {
            //date header row
            startOfDate = row.indexOf("headText") + 10
            endOfDate = row.indexOf("</b>")
            lengthOfDate = endOfDate - startOfDate
            htmlDate = row.substr(startOfDate, lengthOfDate)
            strDate = htmlDate.replace('&nbsp;', ' ').replace('</span>', '').replace('&nbsp;', '')
            console.log('Processing classes for ', strDate)
        }
        if (row.includes(`class="evenRow"`) || row.includes(`class="oddRow"`)) {
            //class row
            let thisClass = new Object()
            thisClass.date = strDate
            rowData = row.split('</td>')
            //TD0 - time
            timeStart = rowData[0].indexOf('&nbsp;')
            thisClass.time = rowData[0].substr(timeStart).replace(/&nbsp;/g, '')
            //TD1 - sign-up button & slots inc. ID code
            if (rowData[1].indexOf('Open') !== -1) {
                slotStart = rowData[1].indexOf(';Open') - 7
                thisClass.slots = parseInt(rowData[1].substr(slotStart, 2).replace(';', ''))
            }
            if (rowData[1].indexOf('name') !== -1) {
                idStart = rowData[1].indexOf('name') + 6
                thisClass.id = rowData[1].substr(idStart, 7)
            }
            //TD2 - class name
            classStart = rowData[2].indexOf('c">') + 3
            thisClass.name = rowData[2].substr(classStart).replace('</a>', '').replace('d>', '')
            //TD3 - coach
            coachEnd = rowData[3].indexOf('<span') - 1
            if (coachEnd > 0) {
                thisClass.coach = rowData[3].substr(0, coachEnd).replace('<td>', '')
            } else {
                thisClass.coach = rowData[3].replace('<td>', '')
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

 module.exports = {getClasses, checkBookingValidity, book}