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
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)

const recipients = 'me@chrisrothwell.com; chrisrothwell@nets.com.sg'
const inviteDefault = {
    'bufferBeforeMins': 30,
    'bufferAfterMins': 30,
    'dur': 60,
    'loc': 'Mobilus Chinatown, 90 Eu Tong Sen Street, Singapore 059811',
    'urlBase': 'https://p3nk98mdn0.execute-api.ap-southeast-1.amazonaws.com/dev/booking/'
}

async function queued(booking) {
    console.log('Sending notification for unconfirmed booking')
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

    transporter.sendMail(
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
        },
        (err, info) => {
            if (err) { throw err }
            console.log(info.envelope);
            console.log(info.messageId);
            return(info.messageId)
        }
    );
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

    transporter.sendMail(
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
        },
        (err, info) => {
            if (err) { throw err }
            console.log(info.envelope);
            console.log(info.messageId);
            return(info.messageId)
        }
    );
}

module.exports = {queued, confirmed}