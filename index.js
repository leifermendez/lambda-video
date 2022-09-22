"use strict";
const crypto = require("crypto");
const ytdl = require("ytdl-core");
const AWS = require("aws-sdk");
const fs = require("fs");

const output = "/tmp/video.mp4";
const outputOpt = "/tmp/video-opt.mp4";
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
const saveVideo = async (name) =>
  new Promise((resolve, reject) => {
    console.log("Guardando...");
    const bodyFile = fs.createReadStream(output);
    const paramsSnap = {
      Bucket: AWS_BUCKET_NAME,
      Key: `${name}.mp4`,
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
      outputPath: outputOpt,
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
const downloadVideo = (url) =>
  new Promise((resolve, reject) => {
    try {
      console.log("Iniciando...");
      const videoCore = ytdl(url, {
        range: { start: 0, end: 18500000 },
        quality: "lowest",
      });
      videoCore.pipe(fs.createWriteStream(output));
      videoCore.on("error", (e) => console.log("Error", e));
      videoCore.on("end", () => {
        ytdl(url, { range: { start: 1001 } }).pipe(
          fs.createWriteStream(output, { flags: "a" })
        );
        console.log("Finalizo");
        resolve(true);
      });
    } catch (e) {
      console.log("Error", e.message);
      reject(e.message);
    }
  });

/**
 *
 * @param {*} event
 * @returns
 */
module.exports.makeVideo = async (event) => {
  const idVideo = event.queryStringParameters?.video || null;
  if (!idVideo) return responseHttp(402, "?video= NULL");
  const url = `https://youtu.be/${idVideo}`;
  await downloadVideo(url);
  const save = await saveVideo(idVideo);

  return responseHttp(200, save);
};
