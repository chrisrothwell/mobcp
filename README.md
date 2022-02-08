# mobcp

TODO:

improve booking bot

1. Test waitlist feature
2. take screenshots & upload to s3
	a. unsuccessful booking (no slots)
	b. successful booking
	c. successful waitlist
3. error handling at cron.js or web.js
	a. take screenshot on timeout error
	b. send error e-mail
4. attach screenshots to e-mails
5. Retry mechanism for full classes??

improve calendar invitation

1. make calendar invite standardized for acceptance

RECENT CHANGES:

1. start at 8.59 instead of 9.00
2. booking bot no longer reloads unnecessarily if the date is already displayed on screen.
3. now handles three options after clicking to book: a) bookable, b) waitlistable, c) neither bookable nor waitlistable.
4. send e-mail notification for waitlist or not bookable/waitlistable

CLOUD 9 SETUP:

INCREASE VOLUME SIZE (default is 10GB, not enough for all deps)
if doing this after mounting, do in EC2 console and then:
sudo growpart /dev/xvda 1
sudo xfs_growfs -d /
df -hT (to verify)
check https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/recognize-expanded-volume-linux.html if any problems.

ONE TIME INST
1. npm i
2. npm i -g serverless
3. eval "$(ssh-agent -s)"
4. add key for gitlab (follow instr)
4. sls plugin install serverless-dynamodb-local
5. sls plugin install serverless-offline
6. sls dynamodb install
8. sudo amazon-linux-extras install epel -y
9. sudo yum install -y chromium

EVERY TIME (need to automate)
7. export SERVERLESS_ACCESS_KEY=xxx
8. 
CLOUD 9 TEST:

1. GET queue: curl "http://localhost:3000/dev/queue"
2. GET classes: curl "http://localhost:3000/dev/classes/08022022"
3. POST add to queue: curl -H 'Content-Type: application/json' -d '{"classDate":"Wed 9 February 2022","classTime":"2:00pm UTC+08","className":"Indoor Open Gym (Fully vaccinated individuals only)","mboUsername":"rothwell.chris@gmail.com","mboPassword":"tFdNJE+eDJ9d+9i"}' -X POST 'http://localhost:3000/dev/queue/'
4. run cron: curl "http://localhost:3000/dev/test/cron"