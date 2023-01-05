# Generator Script for Transparency Report Data

This repository contains the scripts used to build Brave's *Transparency Report Data* which drives pages like [brave.com/transparency](https://brave.com/transparency/) and [basicattentiontoken.org/growth](https://basicattentiontoken.org/growth/).

## Setup

Clone and `npm install` to get started.

Several *environment variables* will be required for a successful run:

- `S3_BUCKET` - *The bucket wherein report data is to be maintained*
- `COINBASE_API_KEY`
- `COINBASE_API_SECRET`
- `COINBASE_API_PASSPHRASE`
- `GEMINI_API_KEY`
- `GEMINI_API_SECRET`
- `ADS_SERVER_STATS_CREDENTIAL`

## Building and Testing

With the environment variables in place, and having already ran `npm install`, you can now run `npm run build` or `npm run test` to build and/or test, respectively. Running the *build* script will attempt to generate (or overwrite) a local `transparency.json` file. Running the *test* script will run the same script with *verbose logging* enabled, but will make no attempt to save the resulting file.

## Data Sources and Services

This project pulls data from various services and providers:

Provider | API Key Required | Explanation of Use
-----------------|:---------------:|---------------
[Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html) | ✔ | Storage and retrieval of transparency report data
[Coinbase](https://docs.cloud.coinbase.com/exchange/reference) | ✔ | Querying for previous BAT purchases
[Gemini](https://docs.gemini.com/rest-api/) | ✔ | Querying for previous BAT purchases
[Uphold](https://uphold.com/en/developer/api/documentation/#introduction) | ✖ | Querying for previous BAT purchase details
[bravebat.info](https://bravebat.info/docs/index.html) | ✖ | Community growth metrics
[Ethplorer](https://github.com/EverexIO/Ethplorer/wiki/Ethplorer-API) | ✔* | Querying for BAT info and metrics
[CryptoCompare](https://min-api.cryptocompare.com/documentation) | ✖ | Querying for historical BAT value data
Brave | ✔ | Querying for Ads data and Rewards metrics

<sup>\* Ethplorer offers a ["freekey"](https://github.com/EverexIO/Ethplorer/wiki/Ethplorer-API#api-key-limits) API key for low-traffic, infrequent pings.</sup>

