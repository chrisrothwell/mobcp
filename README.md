# mobcp

TODO:

improve booking bot

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

RECENT CHANGES:

1. start at 8.59 instead of 9.00
2. 

CLOUD 9 SETUP:

INCREASE VOLUME SIZE (default is 10GB, not enough for all deps)
if doing this after mounting, do in EC2 console and then:
sudo growpart /dev/xvda 1
sudo xfs_growfs -d /
df -hT (to verify)
check https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/recognize-expanded-volume-linux.html if any problems.

1. npm i
2. npm i -g serverless
3. eval "$(ssh-agent -s)" and ssh-add and copy id_ed25519 & id_ed25519.pub (maybe)
4. sls plugin install serverless-dynamodb-local
5. sls plugin install serverless-offline
6. sls dynamodb install
7. export SERVERLESS_ACCESS_KEY=AKiTHgfMcZdsxyXA8W2e67xLMFhDM9PvpIAuwHrVvMXMO
8. sudo amazon-linux-extras install epel -y
9. sudo yum install -y chromium

CLOUD 9 TEST:

1. GET queue: curl "http://localhost:3000/dev/queue"
2. GET classes: curl "http://localhost:3000/dev/classess/08022022"
2. POST: 
Private Key:
