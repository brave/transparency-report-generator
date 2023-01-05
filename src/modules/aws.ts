import AWS from "aws-sdk";
const S3_BUCKET = process.env.S3_BUCKET;

export async function uploadToBucket(
  Key: string,
  Body: string,
  Bucket: string | undefined = S3_BUCKET,
  ACL: string = "public-read",
  CacheControl: string = "max-age=1800"
) {
  if (typeof Bucket === "undefined") {
    throw new Error("No S3 bucket specified");
  }
  const s3 = new AWS.S3({ region: "us-west-2" });
  const params = { Bucket, Key, Body, ACL, CacheControl };
  await s3
    .putObject(params)
    .promise()
    .catch((err: Error) => {
      throw err;
    });
}
