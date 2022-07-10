//const puppeteer = require('puppeteer');
const chromium = require('chrome-aws-lambda');
const IS_OFFLINE = process.env.IS_OFFLINE;
const q = require('./queue.js');
const notif = require('./notify.js')
const dayjs = require('dayjs')
const twoFATimeout = 5 //number of mnins to wait for user input on 2FA

/* 
const customParseFormat = require('dayjs/plugin/customParseFormat')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)




// NB - this is in two places - web and queue.  Think about moving this to a config file
const startBooking = {
    'daysBefore': 2,
    'timeReleasedHr': 9,
    'timeReleasedMin': 0,
    'minsBeforeRelease': 2,
    'retryTimeoutMins': 1
}

*/

const creds = {
    'username': 'chrisr',
    'password': 'cUg953ZQ97Q!CaF'
}

const urls = {
    'loginpage': 'https://qms.avs.gov.sg/Public/Login.aspx'
}

async function chkAvail(params) {
    const p = params
    console.log('begin check availability for  ', p)

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
    await page.goto(urls.loginpage);
    console.log('waiting for selector')
    await page.waitForSelector('#txtLoginName', { visible: true, timeout: 10000 })
    console.log('username box there')
    await page.evaluate((b) => { document.querySelector('#txtLoginName').value = creds.username }, p)
    await page.evaluate((b) => { document.querySelector('#txtPassword').value = creds.password }, p)
    console.log('username entered')
    await page.click('#btnLogin')
    console.log('button clicked')
    const loginPromises = [
        page.waitForSelector('#ctl00$MainContent$SendSMSButton', { visible: true, timeout: 10000}),
        page.waitForSelector('#ctl00_MainContent_imgCaptcha', { visible: true, timeout: 10000})
    ]
    await Promise.race(loginPromises)
    const loginError = await page.evaluate(() => document.querySelector('#lblError')?.textContent)
    if ( loginError ) {
        q.updateNidStatus(p.nid, 'UNABLE TO LOGIN')
        q.removeFromQueue(p.nid)
        p.pStatus = loginError
        notif.failed(p)
        await browser.close();
        return null
    }
    console.log('login action completed, 2FA page displayed')
    
    // FIRST TWOFA STEP - CONFIRM CAPTCHA
    
    let firstTwoFARequest = {
        captcha: document.querySelector('#ctl00_MainContent_imgCaptcha'),
        captchaExt: 'png',
        subj: 'QMS 2FA - first stage',
        factors: ['captcha'],
    }
    

    firstTwoFARequest.nid = await q.req2FA(firstTwoFARequest)
    notif.req2FA(firstTwoFARequest)
    
    console.log('notification sent for first 2FA, awaiting user to enter 2FA')
    const waitForFirst2FAUntil = dayjs().add(twoFATimeout,'minutes')
    console.log('user has until ', waitForFirst2FAUntil.format())
    
    while (dayjs().isBefore(waitForFirst2FAUntil)) {
        // FIRST TWOFA REQUEST LOOP
        
        let twoFAResp = q.checkTwoFA(firstTwoFARequest.nid)
        if (twoFAResp) {
            //2FA has been provided, try to enter it and request second step 2FA
            await page.evaluate((b) => { document.querySelector('#ctl00$MainContent$txtCaptcha').value = twoFAResp.captcha }, p)
            page.click('#ctl00$MainContent$SendSMSButton')
            console.log('SMS OTP Requested')
            const postFirst2FAPromises = [
                page.waitForSelector('#ctl00_divSuccess', { visible: true, timeout: 10000}),
                page.waitForSelector('#ctl00_MainContent_rfvCaptcha', { visible: true, timeout: 10000}),
                page.waitForSelector('#ctl00_divUnsuccess', { visible: true, timeout: 10000})
            ]
            await Promise.race(loginPromises)
            console.log('One of the promises resolved ', postFirst2FAPromises)
            const isSuccess = await page.evaluate(() => document.querySelector('#ctl00_spnSuccess')?.value)
            if (isSuccess) {
                //Request Next Step of 2FA
                console.log('SMS should have been sent: ', isSuccess)
                let secondTwoFARequest = {
                    captcha: document.querySelector('#ctl00_MainContent_imgCaptcha'),
                    captchaExt: 'png',
                    subj: 'QMS 2FA - second stage',
                    factors: ['SMSOTP','captcha'],
                }
            
                secondTwoFARequest.nid = await q.req2FA(secondTwoFARequest)
                notif.req2FA(secondTwoFARequest)
    
                console.log('notification sent for second 2FA, awaiting user to enter 2FA')
                const waitForSecond2FAUntil = dayjs().add(twoFATimeout,'minutes')
                console.log('user has until ', waitForSecond2FAUntil.format())
            
                while (dayjs().isBefore(waitForSecond2FAUntil)) {
                    let twoFAResp = q.checkTwoFA(secondTwoFARequest.nid)
                    if (twoFAResp) {
                        //2FA has been provided, try to enter it and try to login
                        await page.evaluate((b) => { document.querySelector('#ctl00$MainContent$SMSPinTextBox').value = twoFAResp.SMSOTP }, p)
                        await page.evaluate((b) => { document.querySelector('#ctl00$MainContent$txtCaptcha').value = twoFAResp.captcha }, p)
                        page.click('#ctl00$MainContent$SMSSubmitButton')
                        console.log('sms and captcha entered and button clicked')
                        const postFirst2FAPromises = [
                            page.waitForSelector('.welcome', { visible: true, timeout: 10000}),
                            page.waitForSelector('#ctl00_spTitle', { visible: true, timeout: 10000}),
                        ]
                        await Promise.race(loginPromises)
                        console.log('One of the promises resolved ', postFirst2FAPromises)
                        // WE COULD HANDLE ERRORS HERE BUT NOT GOING TO
                        // NOW CHECK FOR AVAILABILITY
                        /*
                            1. CLICK ctl00_MainContent_lnkLargeMammals
                            2. CLICK ctl00$MainContent$btnContinue
                            3. FILL FORM FOR 1 CAT FAN
                            4. CHECK AVAILABILITY FROM TODAY (4 days from now?) and LOOP EVERY 29 DAYS UNTIL INPUT ID IS THERE: ctl00_MainContent_AvailablitySection_ctl00_rdlAvailableDates_0
                            5. CLICK CLEAR
                            6. REPEAT 3/4 FOR ONE CAT AIRCON
                            9. SEND NOTIF ON EARLIEST AVAILABLE DATE
                        */
                    } else {
                        console.log('no reply to second 2fa request, retry in 10 seconds')
                        delay(10000)
                    }
                }
                
                console.log('not able to get through second 2FA, maybe user didnt provide input')
                q.updateNidStatus(secondTwoFARequest.nid, '2FA Timeout')
                notif.fail2FA(secondTwoFARequest)
                await browser.close();
                return new Promise(reject => {reject(new Error('2FA failed for QMS booking'))})
    
            }
            
            console.log('First 2FA was not successful, maybe user provided wrong input')
            q.updateNidStatus(firstTwoFARequest.nid, '2FA Fail')
            notif.fail2FA(firstTwoFARequest)
            await browser.close();
            return new Promise(reject => {reject(new Error('2FA failed for QMS booking'))})
            
        }
        console.log('no reply to first 2fa request, retry in 10 seconds')
        delay(10000)
    }
    
    console.log('not able to get through first 2FA, maybe user didnt provide input')
    q.updateNidStatus(firstTwoFARequest.nid, '2FA Timeout')
    notif.fail2FA(firstTwoFARequest)
    await browser.close();
    return new Promise(reject => {reject(new Error('2FA failed for QMS booking'))})
}


 function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

 module.exports = {getClasses, book}
 //module.exports = {checkBookingValidity}