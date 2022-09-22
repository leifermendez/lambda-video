"use strict";
const crypto = require("crypto");
const AWS = require("aws-sdk");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const OS_SYSTEM = process.platform || "win32";

const ffmpegPath =
  OS_SYSTEM === "win32"
    ? require("@ffmpeg-installer/ffmpeg").path
    : "/opt/ffmpeg/ffmpeg";
const ffprobePath =
  OS_SYSTEM === "win32"
    ? require("@ffprobe-installer/ffprobe").path
    : "/opt/ffmpeg/ffprobe";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
1;
const output = "/tmp/video.mp4";
const outputResize = "/tmp/reize-video.mp4";
const AWS_REGION = process.env.APP_AWS_REGION || "us-east-1";
const AWS_BUCKET_NAME = process.env.APP_AWS_BUCKET_NAME || "";
const AWS_ID = process.env.APP_AWS_ID || "";
const AWS_KEY = process.env.APP_AWS_KEY || "";
AWS.config.update({
  accessKeyId: AWS_ID,
  secretAccessKey: AWS_KEY,
  region: AWS_REGION,
});

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
/**
 *
 * @param {*} statusCode
 * @param {*} message
 * @returns
 */
const responseHttp = (statusCode = 200, message = "todo bien") => {
  return {
    statusCode,
    body: JSON.stringify({
      message,
    }),
  };
};

/**
 *
 * @returns
 */
const saveVideo = async () =>
  new Promise((resolve, reject) => {
    console.log("Guardando...");
    const bodyFile = fs.createReadStream(outputResize);
    const paramsSnap = {
      Bucket: AWS_BUCKET_NAME,
      Key: `resize-${crypto.randomBytes(20).toString("hex")}.mp4`,
      Body: bodyFile,
      ContentType: "video/mp4",
      ACL: "public-read",
    };

    s3.upload(paramsSnap, function (err, data) {
      if (err) reject(err);
      resolve(data);
    });
  });

/**
 *
 * @param {*} opts
 * @returns
 */
const videoResize = () =>
  new Promise((resolve, reject) => {
    const opts = {
      inputPath: output,
      outputPath: outputResize,
      format: "mp4",
      size: "640x480",
    };

    ffmpeg(opts.inputPath)
      .videoCodec(opts.videoCodec || "libx264")
      .format(opts.format)
      .noAudio()
      .size(opts.size)
      .duration(20)
      .on("error", (err) => {
        return reject(err);
      })
      .on("end", () => {
        return resolve(opts.outputPath);
      })
      .save(opts.outputPath);
  });

/**
 *
 * @param {*} url
 * @returns
 *
 */
const downloadVideoFromS3 = (fileKey) =>
  new Promise((resolve, reject) => {
    const file = fs.createWriteStream(output),
      stream = s3
        .getObject({
          Bucket: AWS_BUCKET_NAME,
          Key: `${fileKey}.mp4`,
        })
        .createReadStream();
    stream.on("error", reject);
    file.on("error", reject);
    file.on("finish", () => {
      console.log("downloaded", fileKey);
      resolve(outputResize);
    });
    stream.pipe(file);
  });

/**
 *
 * @param {*} event
 * @returns
 */
module.exports.makeVideo = async (event) => {
  const fileKey = event.queryStringParameters?.video || null;
  if (!fileKey) return responseHttp(402, "?video= NULL");
  await downloadVideoFromS3(fileKey);
  await videoResize();
  const save = await saveVideo();

  return responseHttp(200, save);
};
