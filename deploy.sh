#! /bin/bash

pwd
ls
npm install - g serverless
pwd
ls
sls info --verbose
serverless info --verbose
serverless deploy --stage dev --package /$CODEBUILD_SRC_DIR/target/dev -v
