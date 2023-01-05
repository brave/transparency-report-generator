SHELL := /bin/bash
WORKSPACE := $(PWD)
TMP_WORKSPACE := build
FUNCTION_NAME=transparency-report-generator

clean:
	test -f $(TMP_WORKSPACE)/$(FUNCTION_NAME).zip && rm $(TMP_WORKSPACE)/$(FUNCTION_NAME).zip || echo "clean"

install:
	npm install

run-local:
	npm run local

run-docker:
	docker build -t ${FUNCTION_NAME}:latest .
	docker run --name ${FUNCTION_NAME} -p 9000:8080 --rm -e ADS_SERVER_STATS_CREDENTIAL=${ADS_SERVER_STATS_CREDENTIAL} -e S3_BUCKET=${S3_BUCKET} -e DEBUG=true -e COINBASE_API_KEY=${COINBASE_API_KEY} -e COINBASE_API_SECRET=${COINBASE_API_SECRET} -e COINBASE_API_PASSPHRASE=${COINBASE_API_PASSPHRASE} -e GEMINI_API_KEY=${GEMINI_API_KEY} -e GEMINI_API_SECRET=${GEMINI_API_SECRET} ${FUNCTION_NAME}:latest &
	sleep 3
	curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'
	docker rm -f ${FUNCTION_NAME}

build: clean install
	rm -rf $(TMP_WORKSPACE)
	mkdir -p $(TMP_WORKSPACE)
	cp -r node_modules dist transactionIDs $(TMP_WORKSPACE)
	cd $(TMP_WORKSPACE) && zip -r $(FUNCTION_NAME).zip *
