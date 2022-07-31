const nodemailer = require('nodemailer');
const aws = require('aws-sdk')
const ses = new aws.SES({
  apiVersion: "2010-12-01",
  region: "ap-southeast-1",
});
let transporter = nodemailer.createTransport({
  SES: { ses, aws },
});

const ical = require('ical-generator');
const dayjs = require('dayjs')

const recipients = 'me@chrisrothwell.com; chris.rothwell@singtel.com'
const inviteDefault = {
    'bufferBeforeMins': 30,
    'bufferAfterMins': 30,
    'dur': 60,
    'loc': 'Mobilus Chinatown, 90 Eu Tong Sen Street, Singapore 059811',
    'urlBase': 'https://p3nk98mdn0.execute-api.ap-southeast-1.amazonaws.com/dev/booking/'
}

async function queued(booking) {
    console.log('Sending notification for unconfirmed (queued) booking')
    const b = booking
    const ics = ical({
        domain: 'chrisrothwell.com',
        name: 'Unconfirmed Booking'
    })
    
    ics.createEvent({
        start: dayjs(b.parsedDT).subtract(inviteDefault.bufferBeforeMins, 'minute'),
        end: dayjs(b.parsedDT).add(inviteDefault.dur + inviteDefault.bufferAfterMins, 'minute'),
        summary: 'QUEUED - ' + b.className,
        description: JSON.stringify(b),
        location: inviteDefault.loc,
        url: inviteDefault.urlBase + b.nid,
        organizer: {
            name: 'MobCP Bot',
            email: 'mobcp@chrisrothwell.com'
        }
    });

    console.log(JSON.stringify(ics))

    let msgResp

    try {
        msgResp = await transporter.sendMail(
        {
            from: "mobcp@chrisrothwell.com",
            to: recipients,
            subject: "Booking queued (unconfirmed)",
            text: JSON.stringify(b),
            icalEvent: {
                filename: 'unconfirmed-booking.ics',
                method: 'REQUEST',
                content: Buffer.from(ics.toString())
            }
        })
    } catch (e) {
        console.log(e)
        throw new Error(e)
    }

    console.log(msgResp.envelope)
    console.log(msgResp.messageId)
    return msgResp.messageId
}

async function confirmed(booking) {
    console.log('Sending notification for confirmed booking')
    const b = booking
    const ics = ical({
        domain: 'chrisrothwell.com',
        name: 'Unconfirmed Booking'
    })
    
    ics.createEvent({
        start: dayjs(b.parsedDT).subtract(inviteDefault.bufferBeforeMins, 'minute'),
        end: dayjs(b.parsedDT).add(inviteDefault.dur + inviteDefault.bufferAfterMins, 'minute'),
        summary: 'CONFIRMED - ' + b.className,
        description: JSON.stringify(b),
        location: inviteDefault.loc,
        url: inviteDefault.urlBase + b.nid,
        organizer: {
            name: 'MobCP Bot',
            email: 'mobcp@chrisrothwell.com'
        }
    });

    console.log(JSON.stringify(ics))

    let msgResp

    try {
        msgResp = await transporter.sendMail(
        {
            from: "mobcp@chrisrothwell.com",
            to: recipients,
            subject: "Booking confirmed",
            text: JSON.stringify(b),
            icalEvent: {
                filename: 'confirmed-booking.ics',
                method: 'REQUEST',
                content: Buffer.from(ics.toString())
            }
        })
    } catch (e) {
        console.log(e)
        throw new Error(e)
    }

    console.log(msgResp.envelope)
    console.log(msgResp.messageId)
    return msgResp.messageId
}

async function failed(booking) {
    console.log('Sending notification for failed booking')
    const b = booking
    let msgResp
    
    try {
        msgResp = await transporter.sendMail(
        {
            from: "mobcp@chrisrothwell.com",
            to: recipients,
            subject: "Booking failed - " + b.pStatus,
            text: JSON.stringify(b) + ' ' + inviteDefault.urlBase + b.nid
        });
    } catch (e) {
        console.log(e)
        throw new Error(e)
    }

    console.log(msgResp.envelope)
    console.log(msgResp.messageId)
    return msgResp.messageId
}

async function test() {
    console.log('Sending test notification')
    let msgResp

    try {
        msgResp = await transporter.sendMail(
        {
            from: "mobcp@chrisrothwell.com",
            to: recipients,
            subject: "Test Notification",
            text: `This is a test notification.
            
            Recipients:
            ${JSON.stringify(recipients)}
            
            Invite Defaults:
            ${JSON.stringify(inviteDefault)}
            
            `
        }
        );
    } catch (e) {
        console.log(e)
        throw new Error(e)
    }

    console.log(msgResp.envelope)
    console.log(msgResp.messageId)
    return msgResp.messageId
}

async function reqTwoFA(req) {
    console.log('Sending notification for 2FA')
    console.log(req)
    const d = req
    let msgResp

    try {
        msgResp = await transporter.sendMail(
        {
            from: "mobcp@chrisrothwell.com",
            to: recipients,
            subject: "2FA required - " + d.subj,
            text: `2FA is required for a bot to proceed.
            
            2FA requirements: ${JSON.stringify(d.factors)}
            URL to provide: XXFILLUPLATER
            `,
            attatchments: [{
                filename: 'captcha.jpg',
                content: d.captchaBuffer,
                contentType: 'image/jpeg'
            }, {
                filename: 'text1.txt',
                content: 'hello world!'}
            ]
        });
    } catch (e) {
        console.log(e)
        throw new Error(e)
    }

    console.log(msgResp.envelope)
    console.log(msgResp.messageId)
    return msgResp.messageId
}

async function failTwoFA(req) {
    console.log('Sending notification for failed 2FA')
    const d = req
    let msgResp
    
    try {
        msgResp = await transporter.sendMail(
        {
            from: "mobcp@chrisrothwell.com",
            to: recipients,
            subject: "2FA Timeout - " + d.subj,
            text: `2FA timed out.
            
            2FA requirements: ${JSON.stringify(d.factors)}
            `
        });
    } catch (e) {
        console.log(e)
        throw new Error(e)
    }

    console.log(msgResp.envelope)
    console.log(msgResp.messageId)
    return msgResp.messageId
}

async function qmsavail(fan, ac) {
    console.log('Sending notification for available dates')
    let msgResp
    
    try {
        msgResp = await transporter.sendMail(
        {
            from: "mobcp@chrisrothwell.com",
            to: recipients,
            subject: "Earliest available dates on QMS",
            text: `
            FAN Availability: ${fan}
            AC Availability: ${ac}
            `
        });
    } catch (e) {
        console.log(e)
        throw new Error(e)
    }

    console.log(msgResp.envelope)
    console.log(msgResp.messageId)
    return msgResp.messageId
}

async function qmsloginfail(creds, loginError) {
    console.log('Sending notification for qms login fail')
    let msgResp
    
    try {
        msgResp = await transporter.sendMail(
        {
            from: "mobcp@chrisrothwell.com",
            to: recipients,
            subject: "QMS login fail",
            text: `Failed for username and password
            username: ${creds.username}
            password: <redcated>
            error: ${loginError}`
        });
    } catch (e) {
        console.log(e)
        throw new Error(e)
    }

    console.log(msgResp.envelope)
    console.log(msgResp.messageId)
    return msgResp.messageId
}

module.exports = {queued, confirmed, failed, test, reqTwoFA, failTwoFA, qmsloginfail, qmsavail}