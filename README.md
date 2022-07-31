# mobcp

TODO:

improve booking bot

1. Change minsBeforeRelease to 2mins and retryTimeoutMins to 3mins and test that cron at 8.59am will fire and retry regularly for a quick booking at 9am
2. check why it only adds 1 day instead of 2 days per config when before 9am (something with timezone) - maybe mixed config as its in two places
3. check why after processing booking the item is still being compared
4. In case of timeout AFTER pressing button, the function will correctly error but will keep retrying resulting in a NO BUTTON issue. Add a check during retry to determine if the class is already confirmed.
5. Test waitlist feature
6. take screenshots & upload to s3
	a. unsuccessful booking (no slots)
	b. successful booking
	c. successful waitlist
7. error handling at cron.js or web.js
	a. take screenshot on timeout error
	b. send error e-mail
8. attach screenshot s3 links to e-mails
9. Retry mechanism for full classes??

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
7. export SERVERLESS_ACCESS_KEY=AKiTHgfMcZdsxyXA8W2e67xLMFhDM9PvpIAuwHrVvMXMO
8. if sls offline start is not working, check serverless.yml and make sure the plugins aren't commented out (comment out for deployment)
9. maybe need this:
   git config --global user.email "me@chrisrothwell.com"
   git config --global user.name "Chris Rothwell"

CLOUD 9 TEST:

1. GET queue: curl "http://localhost:3000/dev/queue"
2. GET classes: curl "http://localhost:3000/dev/classes/08022022"
3. POST add to queue: curl -H 'Content-Type: application/json' -d '{"classDate":"Wed 9 February 2022","classTime":"2:00pm UTC+08","className":"Indoor Open Gym (Fully vaccinated individuals only)","mboUsername":"rothwell.chris@gmail.com","mboPassword":"tFdNJE+eDJ9d+9i"}' -X POST 'http://localhost:3000/dev/queue/'
4. run cron: curl "http://localhost:3000/dev/test/cron"
5. 
curl -H 'Content-Type: application/json' \
-H 'authorization: eyJraWQiOiJMMGE0aDg5VDlQZHVoK01BOFhvWlF6aE1lUjA0blFzUkJDdTV6T1NqMURZPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJmNjRkNWQwMy05NGZmLTQ0YmItYTcxOS0yZjQyMjA0YTJkN2IiLCJjdXN0b206YXBpLXVwZGF0ZSI6IjEiLCJjdXN0b206bmV3c2xldHRlciI6IjEiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfSXY0aFdVRXU0IiwiY3VzdG9tOmF0dGVtcHQiOiI0IiwiYXV0aF90aW1lIjoxNjQ0NDc4OTUwLCJjdXN0b206YzEiOiJUaHUgRmViIDEwIDIwMjIgMTQ6MzU6MjggR01UKzA4MDAgKFNpbmdhcG9yZSBTdGFuZGFyZCBUaW1lKSIsImV4cCI6MTY0NDQ4MjU1MCwiY3VzdG9tOnJvbGUiOiJhZG1pbiIsImlhdCI6MTY0NDQ3ODk1MCwiZW1haWwiOiJjaHJpc3JvdGh3ZWxsQG5ldHMuY29tLnNnIiwiY3VzdG9tOm9yZ2FuaXphdGlvbiI6Ik5FVFMiLCJjdXN0b206Y291bnRyeSI6ImVuLSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV9udW1iZXJfdmVyaWZpZWQiOmZhbHNlLCJjdXN0b206bGFzdF9yZXNldCI6IjlcLzEzXC8yMDIxIiwiY29nbml0bzp1c2VybmFtZSI6ImY2NGQ1ZDAzLTk0ZmYtNDRiYi1hNzE5LTJmNDIyMDRhMmQ3YiIsImdpdmVuX25hbWUiOiJDaHJpcyIsImN1c3RvbTpibG9ja2VkIjoiMCIsImN1c3RvbTpsYXN0X2F0dGVtcHQiOiIyXC8xMFwvMjAyMiIsImF1ZCI6IjFjaDhmczJyZmtlY3BpdW03M203OTQwZHYiLCJldmVudF9pZCI6ImU5Nzk3ZTM2LTRhY2YtNDM0Yy04ODMyLTkzM2RkNDNkY2NkNSIsInRva2VuX3VzZSI6ImlkIiwibmFtZSI6IkNocmlzIFJvdGh3ZWxsIiwicGhvbmVfbnVtYmVyIjoiKzY1OTA2NzY2MTAiLCJmYW1pbHlfbmFtZSI6IlJvdGh3ZWxsIn0.WS58i5Fl3a-Cztt-IJyR7bjQ4xJSBgKo7hJqnQD0WvaMpYNLG6pNOLzvcYvkYbokZM82Vr4DbLKrQI9ediyHDQp73D_KOcyMcZnhEXt7IwIhRdoMox60aSmqT0ikSTgFtPBqQofdKerkelRbCOzf5QQvBLBbQH19OUwwmzn17pxqXLB0imOXIUCK6UxicVU1XJJZW3ajLCD0c9dJ_tkdFYtSmM7IsYUdKhCZAcOazpzKDOWAJva-qgxfvxNZhbIBDw1O47h-eeNFPHiCGaVUQpI5FY58jY8b8UaZGk9GY4nYdmeUp95QqNLN9KuKN-0xRtozQbJeKfpaXDoCdfK6Yw' \
-d '{"appId":"c1ecd462-9b79-4038-b8d4-a7d1e061fe4e","ownerId":"app:1234abcd","email":"me@chrisrothwell.com","name":"Chris Rothwell"}' -X POST 'https://api.aws-uat-developer.nets.com.sg/api/delegate/post'

curl -H 'Content-Type: application/json' \
-H 'authorization: eyJraWQiOiJMMGE0aDg5VDlQZHVoK01BOFhvWlF6aE1lUjA0blFzUkJDdTV6T1NqMURZPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJmMTM3NTAwNy02OTQ2LTQzOWItOTM2Ny0zNGFiMDg5ZjI0MzgiLCJjdXN0b206YXBpLXVwZGF0ZSI6IjAiLCJjdXN0b206bmV3c2xldHRlciI6IjAiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfSXY0aFdVRXU0IiwiY3VzdG9tOmF0dGVtcHQiOiI0IiwiYXV0aF90aW1lIjoxNjQ0NDc4NTgxLCJjdXN0b206YzEiOiJUaHUgRmViIDEwIDIwMjIgMDM6Mjc6MzEgR01UKzAwMDAgKENvb3JkaW5hdGVkIFVuaXZlcnNhbCBUaW1lKSIsImV4cCI6MTY0NDQ4MjE4MSwiY3VzdG9tOnJvbGUiOiJkZXZlbG9wZXIiLCJpYXQiOjE2NDQ0Nzg1ODEsImVtYWlsIjoibWVAY2hyaXNyb3Rod2VsbC5jb20iLCJjdXN0b206b3JnYW5pemF0aW9uIjoiTkVUUyIsImN1c3RvbTpjb3VudHJ5IjoiZW4tU0ciLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfbnVtYmVyX3ZlcmlmaWVkIjpmYWxzZSwiY3VzdG9tOmxhc3RfcmVzZXQiOiIyXC85XC8yMDIyIiwiY29nbml0bzp1c2VybmFtZSI6ImYxMzc1MDA3LTY5NDYtNDM5Yi05MzY3LTM0YWIwODlmMjQzOCIsImdpdmVuX25hbWUiOiJDaHJpcyIsImN1c3RvbTpibG9ja2VkIjoiMCIsImN1c3RvbTpsYXN0X2F0dGVtcHQiOiIyXC8xMFwvMjAyMiIsImF1ZCI6IjFjaDhmczJyZmtlY3BpdW03M203OTQwZHYiLCJldmVudF9pZCI6IjIzMzE3ZDYyLTE1ODUtNDU1Mi04NDVmLTk1NjRmMWFhMGYzNCIsInRva2VuX3VzZSI6ImlkIiwibmFtZSI6IkNocmlzIFJvdGh3ZWxsIiwicGhvbmVfbnVtYmVyIjoiKzY1OTA2NzY2MTAiLCJmYW1pbHlfbmFtZSI6IlJvdGh3ZWxsIn0.BfMB2pJfkAY90AAPGTGnV9tceToXkhmmXYdolQQbAYf7EyXUbk9HT0vHKYCrzv_itKT8LZDerFplv59y_Ox3LGCzBrTN1ZUY04B0i5VE3PV8417Hin7FF18zgvBqKX66TybWDTOhzU2XSmrhdrhy-m1d_Dl9DFeQhQUFJrFfEEdcjE1RzZy6yBPF3_lgXSCjtazCeELUA8Q72UX3tB03Uh75-UT7Gb_O03aTlC9soMxSNCoXLe79xYIXHLoAE_idr-CvSnbyuduYcRMwVR57SXJvO8FpXvZcpl26SXzrVs2GVEYt6qUp8GPpZr8fk3WGMTEAJqCO4HWmtF4s3Zvv2Q' \
-d '{"appId":"fc21f229-32bb-1223-494e-2e9e8a8a907","ownerId":"app:1234abcd","email":"me@chrisrothwell.com","name":"Chris Rothwell"}' -X POST 'https://api.aws-uat-developer.nets.com.sg/api/delegate/get'

curl 'https://api.aws-uat-developer.nets.com.sg/api/delegate' -X 'DELETE' -H 'content-type: application/json; charset=UTF-8' -H 'accept: application/json, text/plain, */*' \
-H 'authorization: eyJraWQiOiJMMGE0aDg5VDlQZHVoK01BOFhvWlF6aE1lUjA0blFzUkJDdTV6T1NqMURZPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJmNjRkNWQwMy05NGZmLTQ0YmItYTcxOS0yZjQyMjA0YTJkN2IiLCJjdXN0b206YXBpLXVwZGF0ZSI6IjEiLCJjdXN0b206bmV3c2xldHRlciI6IjEiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfSXY0aFdVRXU0IiwiY3VzdG9tOmF0dGVtcHQiOiI0IiwiYXV0aF90aW1lIjoxNjQ0NDc4OTUwLCJjdXN0b206YzEiOiJUaHUgRmViIDEwIDIwMjIgMTQ6MzU6MjggR01UKzA4MDAgKFNpbmdhcG9yZSBTdGFuZGFyZCBUaW1lKSIsImV4cCI6MTY0NDQ4MjU1MCwiY3VzdG9tOnJvbGUiOiJhZG1pbiIsImlhdCI6MTY0NDQ3ODk1MCwiZW1haWwiOiJjaHJpc3JvdGh3ZWxsQG5ldHMuY29tLnNnIiwiY3VzdG9tOm9yZ2FuaXphdGlvbiI6Ik5FVFMiLCJjdXN0b206Y291bnRyeSI6ImVuLSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV9udW1iZXJfdmVyaWZpZWQiOmZhbHNlLCJjdXN0b206bGFzdF9yZXNldCI6IjlcLzEzXC8yMDIxIiwiY29nbml0bzp1c2VybmFtZSI6ImY2NGQ1ZDAzLTk0ZmYtNDRiYi1hNzE5LTJmNDIyMDRhMmQ3YiIsImdpdmVuX25hbWUiOiJDaHJpcyIsImN1c3RvbTpibG9ja2VkIjoiMCIsImN1c3RvbTpsYXN0X2F0dGVtcHQiOiIyXC8xMFwvMjAyMiIsImF1ZCI6IjFjaDhmczJyZmtlY3BpdW03M203OTQwZHYiLCJldmVudF9pZCI6ImU5Nzk3ZTM2LTRhY2YtNDM0Yy04ODMyLTkzM2RkNDNkY2NkNSIsInRva2VuX3VzZSI6ImlkIiwibmFtZSI6IkNocmlzIFJvdGh3ZWxsIiwicGhvbmVfbnVtYmVyIjoiKzY1OTA2NzY2MTAiLCJmYW1pbHlfbmFtZSI6IlJvdGh3ZWxsIn0.WS58i5Fl3a-Cztt-IJyR7bjQ4xJSBgKo7hJqnQD0WvaMpYNLG6pNOLzvcYvkYbokZM82Vr4DbLKrQI9ediyHDQp73D_KOcyMcZnhEXt7IwIhRdoMox60aSmqT0ikSTgFtPBqQofdKerkelRbCOzf5QQvBLBbQH19OUwwmzn17pxqXLB0imOXIUCK6UxicVU1XJJZW3ajLCD0c9dJ_tkdFYtSmM7IsYUdKhCZAcOazpzKDOWAJva-qgxfvxNZhbIBDw1O47h-eeNFPHiCGaVUQpI5FY58jY8b8UaZGk9GY4nYdmeUp95QqNLN9KuKN-0xRtozQbJeKfpaXDoCdfK6Yw' \
--data-raw '{"delegateId":268}'
