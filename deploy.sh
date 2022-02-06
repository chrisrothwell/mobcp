#! /bin/bash

pwd
ls
npm install --silent --no-progress -g npm
npm install --silent --no-progress -g serverless@2
serverless info --verbose
serverless deploy --stage dev --package /$CODEBUILD_SRC_DIR/target/dev --verbose
