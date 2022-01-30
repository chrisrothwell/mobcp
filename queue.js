const AWS = require('aws-sdk')
const { nanoid } = require('nanoid')
const dayjs = require('dayjs')
const customParseFormat = require('dayjs/plugin/customParseFormat')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

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

const startBooking = {
    'daysBefore': 2,
    'timeReleasedHr': 9,
    'timeReleasedMin': 0,
    'minsBeforeRelease': 0,
    'retryTimeoutMins': 1
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

    console.log(params)
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

 async function getBookableQItems() {
    console.log('Getting queue items to try and book')
    q = await getQueue()
    if (q.message === 'No Items in Queue') { 
        console.log('getQueueDetails promise rejects')
        return new Promise(reject => {reject(new Error('No Items in Queue'))})
    }

    let today = dayjs().tz('Asia/Singapore')
    let classesBefore
    console.log(startBooking)
    if ( today.hour() >= startBooking.timeReleasedHr && today.minute() >= startBooking.timeReleasedMin - startBooking.minsBeforeRelease ) {
        console.log('trying to add days ', startBooking.daysBefore)
        classesBefore = dayjs().tz('Asia/Singapore').endOf('day').add(startBooking.daysBefore, 'day')
    } else {
        console.log('trying to add days ', startBooking.daysBefore - 1)
        classesBefore = dayjs().tz('Asia/Singapore').endOf('day').add(startBooking.daysBefore - 1, 'day')
    }
    
    console.log('today is', today.format(), ' eligible to book classes starting before ', classesBefore.format())

    let classesToBook = new Array()
    for (eachNid of q) {
        console.log('comparing ', eachNid)
        let qDetails = await getBookingDetails(eachNid)
        if ((qDetails.pStatus === 'NEW' || qDetails.pStatus === 'QUEUED') && dayjs(qDetails.parsedDT).isBefore(classesBefore) && dayjs(qDetails.parsedDT).isAfter(today)) {
            classesToBook.push(qDetails)
        }
    }

    console.log('Following queue items are eligible to book ', classesToBook)
    
    return classesToBook
 }

 async function newBooking(classDate, classTime, parsedDate, className, mboUsername, mboPassword) {
     //Write the record to Dynamodb
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
    console.log('added to db ', addDB)

    //Add to Queue & Update Queue Status
    
    console.log('trying to add to queue')
    let addResp = await addToQueue(nid)
    console.log('add to queue finished')
    console.log(addResp)
    //console.log('trying to update status')
    //let updStatus = await updateStatus()
    //console.log(updStatus)

    //if successful, return the details.
    return {
        'booking': await getBookingDetails(nid),
        'status': await getStatus()
    }
 }

 module.exports = {getQueue, getQueueDetails, getBookingDetails, removeFromQueue, clearQueue, newBooking, getBookableQItems, updateNidStatus}