//const puppeteer = require('puppeteer');
const chromium = require('chrome-aws-lambda');
const IS_OFFLINE = process.env.IS_OFFLINE;
const q = require('./queue.js');
const notif = require('./notify.js')
const dayjs = require('dayjs')
const twoFATimeout = 5 //number of mnins to wait for user input on 2FA

const customParseFormat = require('dayjs/plugin/customParseFormat')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

const creds = {
    'username': 'chrisr',
    'password': 'cUg953ZQ97Q!CaF'
}

const urls = {
    'loginpage': 'https://qms.avs.gov.sg/Public/Login.aspx',
    'captcha': 'https://qms.avs.gov.sg/CustomControls/CaptchaControl.aspx'
}

const qfaForm = {
    'countryOfExport': 'Malaysia',
    'numberOfCats': 1
}

async function chkAvail() {
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
    await page.evaluate((creds) => { document.querySelector('#txtLoginName').value = creds.username }, creds)
    await page.evaluate((creds) => { document.querySelector('#txtPassword').value = creds.password }, creds)
    console.log('username entered')
    await page.click('#btnLogin')
    console.log('button clicked')
    
    let captchaResp
    try {
        captchaResp = await page.waitForResponse(urls.captcha, { timeout: 10000 })
    } catch {
        console.log('Captcha did not load')
        const loginError = await page.evaluate(() => document.querySelector('#lblError')?.textContent)
        notif.qmsloginfail(creds, loginError)
        await browser.close();
        return new Promise(reject => {reject(new Error('Failed initial QMS login'))})
    }
    
    console.log('login action completed, 2FA page displayed')
    
    // FIRST TWOFA STEP - CONFIRM CAPTCHA
    
    let captchaBuffer = await captchaResp.buffer()
    
    let firstTwoFARequest = {
        captchaBuffer: captchaBuffer,
        captchaExt: 'png',
        subj: 'QMS 2FA - first stage',
        factors: ['captcha'],
    }
    

    firstTwoFARequest.nid = await q.reqTwoFA(firstTwoFARequest)
    notif.reqTwoFA(firstTwoFARequest)
    
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
            
                secondTwoFARequest.nid = await q.reqTwoFA(secondTwoFARequest)
                notif.reqTwoFA(secondTwoFARequest)
    
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
                            page.waitForSelector('#ctl00_spTitle', { visible: true, timeout: 10000})
                        ]
                        await Promise.race(postFirst2FAPromises)
                        console.log('One of the promises resolved ', postFirst2FAPromises)
                        // WE COULD HANDLE ERRORS HERE BUT NOT GOING TO
                        // NOW CHECK FOR AVAILABILITY
                        await page.click('#ctl00_MainContent_lnkLargeMammals')
                        await page.waitForSelector('#ctl00$MainContent$btnContinue', { visible: true, timeout: 10000})
                        await page.click('#ctl00$MainContent$btnContinue')
                        
                        
                        let earliestAvailableDateFan
                        let earliestAvailableDateAC
                        let tryDate = dayjs().tz('Asia/Singapore')
                        let tryType = 'fan'
                        
                        while (!earliestAvailableDateFan && !earliestAvailableDateAC && tryDate.isBefore(dayjs().tz('Asia/Singapore').add(1,'year')) ) {
                            console.log('Trying to book for ', tryType, ' with date ', tryDate.format())
                            await page.evaluate((b) => { document.querySelector('#ctl00$MainContent$secReservationInitialSection$ctl00$ddlCountryOfExport').value = qfaForm.countryOfExport }, p)
                            await page.evaluate((b) => { document.querySelector('#ctl00$MainContent$secReservationInitialSection$ctl00$txtDateOfArrival').value = tryDate.format('DD/MM/YYYY') }, p)
                            await page.evaluate((b) => { document.querySelector('#ctl00$MainContent$secReservationInitialSection$ctl00$txtNoOfCats').value = qfaForm.numberOfCats }, p)
                            if (tryType === 'ac') { await page.evaluate((b) => { document.querySelector('#ctl00$MainContent$secReservationInitialSection$ctl00$txtNoOfACCaterries').value = qfaForm.numberOfCats }, p) }
                            if (tryType === 'fan') { await page.evaluate((b) => { document.querySelector('#ctl00$MainContent$secReservationInitialSection$ctl00$txtNoOfFanCaterries').value = qfaForm.numberOfCats }, p) }
                            await page.evaluate((b) => { document.querySelector('#ctl00_MainContent_secReservationInitialSection_ctl00_rdbLstImportType_0').value = true }, p)
                            await page.click('#ctl00$MainContent$secReservationInitialSection$ctl00$btnCheckAvailablity')
                            await page.waitForSelector('#ctl00$MainContent$btnContinue', { visible: true, timeout: 10000})
                            const postFormSubmitPromises = [
                                page.waitForSelector('#ctl00_MainContent_divNewUnsuccess', { visible: true, timeout: 10000}),
                                page.waitForSelector('#ctl00_MainContent_AvailablitySection_ctl00_rdlAvailableDates_0', { visible: true, timeout: 10000})
                            ]
                            await Promise.race(postFormSubmitPromises)
                            console.log('One of the promises resolved ', postFormSubmitPromises)
                            console.log('DO SOMETHING HERE TO EVALUTE IF ITS THE FIRST OR SECOND PROMISE RESOLVING')
                            if (secondproimseresolved && tryType === 'fan') {
                                
                                earliestAvailableDateFan = await page.evaluate(() => document.querySelector('label').textContent)
                                console.log('fan room found for ', earliestAvailableDateFan)
                                console.log('retrying for AC')
                                tryType = 'ac'
                                tryDate = dayjs().tz('Asia/Singapore')
                            } else if (secondpromiseresolved && tryType === 'ac') {
                                earliestAvailableDateAC = await page.evaluate(() => document.querySelector('label').textContent)
                                console.log('ac room found for ', earliestAvailableDateAC)
                            } else {
                                console.log('no availability, adding 30 days')
                                tryDate.add(30,'day')
                            }
                        }
                        console.log('Earliest availability for fan room is ', earliestAvailableDateFan)
                        console.log('Earliest availability for ac room is ', earliestAvailableDateAC)
                        
                        let notifoutput = notif.qmsavail(earliestAvailableDateFan, earliestAvailableDateAC)
                        await browser.close();
                        return new Promise(resolve => {resolve(notifoutput)})

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

 module.exports = {chkAvail}