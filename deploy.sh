#! /bin/bash

npm install --silent --no-progress -g npm
npm install --silent --no-progress -g serverless
serverless info --verbose
cd node_modules/serverless/
pwd
ls
serverless deploy --stage dev --package /$CODEBUILD_SRC_DIR/target/dev -v
