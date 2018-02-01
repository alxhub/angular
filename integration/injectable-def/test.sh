#!/bin/bash

NPM_BIN=$(npm bin)
PATH="$PATH:${NPM_BIN}"

rm -rf node_modules/lib1_built node_modules/lib2_built dist/

ngc -p tsconfig-lib1.json
ngc -p tsconfig-lib2.json
ngc -p tsconfig-app.json

node ./dist/src/main.js
exit $?