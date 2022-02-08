# mobcp

TODO:

improve booking bot

1. start at 8.59 instead of 9.00
2. make sure the dateHeaders find action (dateOnPage) works to avoid unnecessary reset of date
3. promise race for SubmitEnroll2 OR class full
	a. span class mainTextBig
	b. The class/event that you are trying to reserve is full.
	c. form name="frmWaitList"
4. take screenshots & upload to s3
	a. unsuccessful booking (no slots)
	b. successful booking
	c. successful waitlist
5. send e-mail on unsuccessful booking (no slots)
6. error handling at cron.js or web.js
	a. take screenshot on timeout error
	b. send error e-mail
7. if a waitlist spot is available, add to waitlist instead
	a. button id "AddWLButton"
	b. wait for divid main-content - "My Wait List"
8. in case of error, does the item remain queued?
9. attach screenshots to e-mails

improve calendar invitation

1. make calendar invite standardized for acceptance
