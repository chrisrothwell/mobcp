const serverless = require('serverless-http');
const bodyParser = require('body-parser')
const dayjs = require('dayjs')
const customParseFormat = require('dayjs/plugin/customParseFormat')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(customParseFormat)
dayjs.extend(timezone)

const express = require('express');
var cors = require('cors')
const { getMaxListeners } = require('process');
const app = express()

var corsOptions = {
  origin: 'http://chrisrothwell.com',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

const web = require('./web.js')
const q = require('./queue.js')
const cron = require('./cron.js') // for manual triggering
const notify = require('./notify.js') // for manual triggering

app.use(bodyParser.json());
app.use(cors(corsOptions))
let jsonParser = bodyParser.json()

app.delete('/queue', jsonParser, async (req, res) => {
    const {nid} = req.body

    try {
        let delResp
        if (nid) {
            delResp = await q.removeFromQueue(nid)
        } else {
            delResp = await q.clearQueue()
        }
        
        console.log(delResp)
        res.status(204).end()
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message });
    }
})

app.post('/queue', jsonParser, async (req, res) => {
    const {classDate, classTime, className, mboUsername, mboPassword} = req.body

    if (!classDate || !classTime || !className || !mboUsername || !mboPassword ) {
        console.log('Missing required parameter, received ', req.body)
        res.status(400).json({ error: 'Missing required parameter' })
        return null
    }

    //Validate the date & time
    d = classDate.substr(4) + ' ' + classTime.substr(0,7)
    console.log('Attempting to parse ', d)
    let parsedDate = dayjs(d, "D MMMM YYYY h:mm").tz('Asia/Singapore')
    console.log(parsedDate.format())
    if (parsedDate.isBefore(dayjs())) {
        console.log('Date is before today ', dayjs().format())
        res.status(400).json({ error: 'Class has already started' });
        throw Error('Class has already started.')
    }

    // Register the new booking
    try {
        newBooking = await q.newBooking(classDate, classTime, parsedDate, className, mboUsername, mboPassword)
        res.status(200).json(newBooking)
    } catch(e) {
        console.log(e)
        res.status(400).json({error: err.message})
    }
})

app.get('/queue', async (req, res) => {
    try {
        let queue = await q.getQueue()
        console.log(queue)
        let qd = await q.getQueueDetails(queue)
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
        let b = await q.getBookingDetails(nid)
        if (b) {
            res.status(200).json({ b })
        } else {
            res.status(404).json({error: 'Booking nid not found.'})
        }
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message });
    }
})

app.get('/classes/:ddmmyyyy', async (req, res) => {
    console.log('called Classes API with ', req.params)
    const reqparam = req.params.ddmmyyyy
    if (reqparam.length !== 8) {
        let err = 'Date is in the wrong format'
        console.log('Err: ', err)
        res.status(400).json({ error: err.message });
        return null
    }
    let dateInt = {
        dd: parseInt(reqparam.substr(0, 2)),
        mm: parseInt(reqparam.substr(2, 2)),
        yyyy: yyyyInt = parseInt(reqparam.substr(4, 4))
    }
    console.log(dateInt)
    validateDate = new Date(dateInt.yyyy, dateInt.mm - 1, dateInt.dd)
    if (isNaN(validateDate)) {
        res.status(400).json({ error: 'Unable to parse date.' })
        return null
    }

    console.log('Parsed date as ', validateDate)
    const formatParam = dateInt.dd + '/' + dateInt.mm + '/' + dateInt.yyyy
    const classes = await web.getClasses(formatParam)  
    res.status(200).json(classes)
    return null
})

app.get('/test/cron', async (req, res) => {
// To manually trigger the cron if required
    try {
        let output = await cron.dailySchedule()
        console.log(output)
        res.status(200).send()
    } catch(err) {
        res.status(400).json({ error: err.message });
        return null
    }
})

app.get('/test/notify', async (req, res) => {
// To manually trigger a test e-mail notification
    try {
        let output = await notify.test()
        res.status(200).send(output)
        return null
    } catch(err) {
        res.status(400).json({ error: err.message });
        return null
    }
})

app.get('/test/notify/queued/:booking', async (req, res) => {
// To manually trigger a queued e-mail notification
    try {
        let b = await q.getBookingDetails(req.params.booking)
        let output = await notify.queued(b)
        res.status(200).send(output)
        return null
    } catch(err) {
        res.status(400).json({ error: err.message });
        return null
    }
})

app.get('/test/notify/confirmed/:booking', async (req, res) => {
// To manually trigger a confirmed e-mail notification
    try {
        let b = await q.getBookingDetails(req.params.booking)
        let output = await notify.confirmed(b)
        res.status(200).send(output)
        return null
    } catch(err) {
        res.status(400).json({ error: err.message });
        return null
    }
})

app.get('/test/notify/failed/:booking', async (req, res) => {
// To manually trigger a failed e-mail notification
    try {
        let b = await q.getBookingDetails(req.params.booking)
        let output = await notify.failed(b, 'TEST FAILURE')
        res.status(200).send(output)
        return null
    } catch(err) {
        res.status(400).json({ error: err.message });
        return null
    }
})

module.exports.handler = serverless(app);

