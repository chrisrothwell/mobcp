const serverless = require('serverless-http');
const puppeteer = require('puppeteer');
const AWS = require('aws-sdk')
const bodyParser = require('body-parser')
const { nanoid } = require('nanoid')

const dayjs = require('dayjs')
const customParseFormat = require('dayjs/plugin/customParseFormat')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

const express = require('express');
const { getMaxListeners } = require('process');
const app = express()
const urls = {
    'stafflogin': 'https://clients.mindbodyonline.com/classic/ws?studioid=739798',
    'notstaff': 'https://clients.mindbodyonline.com/ASP/home.asp?studioid=739798',
    'classes': 'https://clients.mindbodyonline.com/classic/mainclass?fl=true&tabID=7',
    'homeredir': 'https://clients.mindbodyonline.com/ASP/su1.asp?studioid=739798&tg=&vt=&lvl=&stype=&view=&trn=0&page=&catid=&prodid=&date=11%2f13%2f2021&classid=0&prodGroupId=&sSU=&optForwardingLink=&qParam=&justloggedin=&nLgIn=&pMode=0&loc=1'
}

const startBooking = {
    'daysBefore': 3,
    'timeReleasedHr': 9,
    'timeReleasedMin': 0,
    'minsBeforeRelease': 5,
    'retryTimeoutMins': 1
}

const DYTBL = process.env.DYTBL;
const IS_OFFLINE = process.env.IS_OFFLINE;

let dynamoDb;
if (IS_OFFLINE === 'true') {
  dynamoDb = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
  })
  console.log('Using local dynamodb');
} else {
  dynamoDb = new AWS.DynamoDB.DocumentClient();
};

app.use(bodyParser.json());
let jsonParser = bodyParser.json()

app.get('/test', function (req, res) {
  res.send('Hello World!')
})

app.delete('/queue', jsonParser, async (req, res) => {
    const {nid} = req.body

    try {
        let delResp
        if (nid) {
            delResp = await removeFromQueue(nid)
        } else {
            delResp = await clearQueue()
        }
        
        console.log(delResp)
        
        if (delResp.message) { 
            res.status(400).json({ error: addResp.message }) 
        } else {
            res.status(204).end()
        }
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message });
    }
})

app.post('/queue', jsonParser, async (req, res) => {
    const {classDate, classTime, className, mboUsername, mboPassword} = req.body

    //Validate the date
    d = classDate.substr(4) + ' ' + classTime.substr(0,7)
    console.log('Attempting to parse ', d)
    let parsedDate = dayjs(d, "D MMMM YYYY h:mm")
    console.log(parsedDate.format())
    if (parsedDate.isBefore(dayjs())) {
        console.log('Date is before today ', dayjs().format())
        res.status(400).json({ error: 'Class has already started' });
        throw Error('Class has already started.')
    }

    //Write the record
    let nid = nanoid()
    const params = {
        TableName: DYTBL,
        Item: {
            nid: nid,
            classDate: classDate,
            classTime: classTime,
            parsedDT: parsedDate.toISOString(),
            className: className,
            mboUsername: mboUsername,
            mboPassword: mboPassword,
            pStatus: 'NEW',
            created: dayjs().toISOString()
        },
    };

    console.log('adding to db')
    console.log(params)
    let addDB = await dynamoDb.put(params).promise()

    try {
        console.log('trying to add to queue')
        let addResp = await addToQueue(nid)
        console.log('add to queue finished')
        console.log(addResp)
        console.log('trying to update status')
        let updStatus = await updateStatus()

        if (addResp.message) { 
            res.status(400).json({ error: addResp.message }) 
        } else if (updStatus.message) {
            res.status(400).json({ error: updStatus.message})
        } else {
            conf = {
                'booking': await getBookingDetails(nid),
                'status': await getStatus()
            }
            res.send(conf)
        }
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message });
    }
})

app.get('/queue', async (req, res) => {
    try {
        let q = await getQueue()
        console.log(q)
        let qd = await getQueueDetails(q)
        res.json({ qd })
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message });
    }
})

app.get('/booking/:id', async (req, res) => {
    let nid = req.params.id
    console.log('nid is',nid)
    try {
        let b = await getBookingDetails(nid)
        res.json({ b })
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err });
    }
})

app.get('/classes/:ddmmyyyy', async (req, res) => {
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
    const reqparam = req.params.ddmmyyyy
    const formatparam = reqparam.substr(0, 2) + '/' + reqparam.substr(2, 2) + '/' + reqparam.substr(4, 4)

    console.log('Default date on MBO is ', defaultDate)
    console.log('Date requested is ', req.params.ddmmyyyy)
    if (defaultDate !== formatparam) {
        console.log('Selecting new date...')
        await page.evaluate((formatparam) => { document.querySelector('#txtDate').value = formatparam }, formatparam)
        await page.focus('#txtDate')
        await page.keyboard.press('Enter')
        await page.waitForSelector('#classSchedule-mainTable', { visible: true, timeout: 10000 })
        console.log('Page loaded')
    }

    // Table includes all classes starting from the previous Monday
    const classTableHTML = await page.evaluate(() => document.querySelector('#classSchedule-mainTable').outerHTML)
    const tableRows = classTableHTML.split('</tr>')
    console.log(tableRows.length, 'records fetched')

    res.send(processClassTable(tableRows))
    await browser.close();
})

app.post('/class/book', jsonParser, async (req, res) => {
    const {nid} = req.body
    console.log('nid is',nid)
    const retryUntil = dayjs().add(startBooking.retryTimeoutMins,'minutes')
    const q = await getQueue()
    let existsInQ = q.find( (e) => e === nid)
    if (!existsInQ) {
        console.log('Booking is not in the queue')
        res.status(400).json({ error: 'Booking is not in the queue'}).end()
        return null
    }
    let b
    try {
        b = await getBookingDetails(nid)
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err }).end();
        return null
    }

    console.log(b)
    let startAfter = dayjs(b.parsedDT).subtract(startBooking.daysBefore, 'days').hour(startBooking.timeReleasedHr).minute(startBooking.timeReleasedMin).subtract(startBooking.minsBeforeRelease, 'minutes')
    console.log('checking if now is after ', startAfter.tz('Asia/Singapore').format())
    if (dayjs().isBefore(startAfter)) {
        res.status(400).json({ error: 'Too early to book.'}).end()
        return null
    } else if (dayjs().isAfter(b.parsedDT)) {
        res.status(400).json({ error: 'Class already started.'}).end()
        updateNidStatus(nid, 'EXPIRED')
        removeFromQueue(nid)
        return null
    } else {
        res.status(202).json({ nid: nid})
    }

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
})

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

 async function getQueue() {
    console.log('getQueue')
    const params = {
        TableName: DYTBL,
        Key: {
          nid: 'queue',
        },
    };
    let query = await dynamoDb.get(params).promise()
    if (query?.Item?.q) {
        return new Promise(resolve => {resolve(query.Item.q)})
    } else {
        console.log('getQueue Promise Rejects')
        return new Promise(reject => {reject(new Error('No Items in Queue'))})
    }
 }

 async function getQueueDetails(q) {
    console.log('getQueueDetails') 
    let jsonResponse = {}
    if (q.message === 'No Items in Queue') { 
        console.log('getQueueDetails promise rejects')
        return new Promise(reject => {reject(new Error('No Items in Queue'))})
    }
    for (const nid of q) {
        console.log('Retrieving booking ',nid)
        jsonResponse[nid] = await getBookingDetails(nid)
    }
    return new Promise(resolve => {resolve(jsonResponse)})
 }

 async function getBookingDetails(bookingid) {
    const params = {
        TableName: DYTBL,
        Key: {
            nid: bookingid,
        },
    };

    let query = await dynamoDb.get(params).promise()
    return new Promise(resolve => {resolve(query.Item)})
 }

 async function getStatus() {
    const params = {
        TableName: DYTBL,
        Key: {
            nid: 'STATUS',
        },
    };

    let query = await dynamoDb.get(params).promise()
    return new Promise(resolve => {resolve(query.Item)})
 }

 async function addToQueue(nid) {
    console.log('adding', nid, 'to queue')
    let q = await getQueue()
    let newBooking = await getBookingDetails(nid)

    if (q.message === 'No Items in Queue') {
        q = new Array()
        q.push(nid) // create new queue with new nid, no need to validate against other queue items.
    } else {
        // Booking was already validated for dt, now check if this is a duplicate
        for (eachNid of q) {
            console.log('comparing ', eachNid)
            let qDetails = await getBookingDetails(eachNid)
            if (qDetails.parsedDT === newBooking.parsedDT && qDetails.className === newBooking.className && qDetails.mboUsername === newBooking.mboUsername) {
                console.log('Duplicate booking detected')
                console.log('Requested booking', newBooking)
                console.log('Matched with previous booking', qDetails)
                let dyResp = await updateNidStatus(nid, 'DUPLICATE')
                console.log(dyResp)
                return new Promise(reject => { reject(new Error('Duplicate booking detected')) })
            }
        }
        q.push(nid)
    }

    const params = {
        TableName: DYTBL,
        Item: {
            nid: 'queue',
            q: q
        },
    };
    console.log('updating status to queued (async) and returning promise to add item to queue')
    updateNidStatus(nid, 'QUEUED')
    console.log(params)
    return dynamoDb.put(params).promise()
 }

 async function removeFromQueue(nid) {
    console.log('removing', nid, 'from queue')
    let q = await getQueue()
    let nq = new Array()

    if (q.message === 'No Items in Queue') {
        q = new Array()
    } else {
        nq = q.filter( (v) => { return v !== nid })
    }

    const params = {
        TableName: DYTBL,
        Item: {
            nid: 'queue',
            q: nq
        },
    };
    console.log(params)
    return dynamoDb.put(params).promise()
 }

 async function clearQueue() {
    const params = {
        TableName: DYTBL,
        Item: {
            nid: 'queue'
        },
    };
    console.log('clearing queue')
    return dynamoDb.put(params).promise()
 }

 async function updateNidStatus(nid, newstatus) {
    console.log('Updating NID status', nid, newstatus)
    var params = {
        TableName: DYTBL,
        Key:{
            "nid": nid
        },
        UpdateExpression: "set pStatus = :s",
        ExpressionAttributeValues:{
            ":s":newstatus,
        },
        ReturnValues:"UPDATED_NEW"
    };
    return dynamoDb.update(params).promise()
 }

 async function updateStatus(q) {
    console.log('Updating system status')
    if (!q) { q = await getQueue() }

    let earliestDate = dayjs().add(1, 'year') //set date arbitrarily
    for (eachNid of q) {
        console.log('comparing ', eachNid)
        let qDetails = await getBookingDetails(eachNid)
        if ((qDetails.pStatus === 'NEW' || qDetails.pStatus === 'QUEUED') && dayjs(qDetails.parsedDT).isBefore(earliestDate) && dayjs(qDetails.parsedDT).isAfter(dayjs())) {
            console.log('earlier date detected ', dayjs(qDetails.parsedDT).format())
            earliestDate = qDetails.parsedDT
        }
    }

    let wakeUp = dayjs(earliestDate).subtract(startBooking.daysBefore, 'days').hour(startBooking.timeReleasedHr).minute(startBooking.timeReleasedMin).subtract(startBooking.minsBeforeRelease, 'minutes')
    if (wakeUp.isBefore(dayjs())) {
        wakeUp = dayjs()
    }

    console.log('System set to wake up at ', wakeUp.format())
    const params = {
        TableName: DYTBL,
        Item: {
            nid: 'STATUS',
            wakeUp: wakeUp.toISOString(),
            disp: 'STATUSUPD'
        }
    };

    console.log('adding to db')
    console.log(params)
    return dynamoDb.put(params).promise()
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
module.exports.handler = serverless(app);