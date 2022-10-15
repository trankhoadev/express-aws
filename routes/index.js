const express = require("express");
const router = express.Router();

/* Import Options */
const path = require("path");
const AWS = require("aws-sdk");
const { v4: uuid } = require("uuid");
const multer = require("multer");

AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_KEY,
  region: process.env.REGION,
});

const docClient = new AWS.DynamoDB.DocumentClient();

const CLOUD_FRONT_URL = "https://d1idmilwflze6k.cloudfront.net/";

const s3 = new AWS.S3({
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey,
});

/* Middle ware */
const checkTypeFile = (file, cb) => {
  let fileType = /jpg|png|gif|jpeg/;
  let extName = fileType.test(path.extname(file.originalname).toLowerCase());
  let mimeType = fileType.test(file.mimetype);

  if (extName && mimeType) {
    return cb(null, true);
  }
  return cb("Error: image only !");
};

const storage = multer.memoryStorage({
  destination(req, file, callback) {
    callback(null, "");
  },
});

const upLoad = multer({
  storage,
  limits: { fileSize: 2000000 },
  fileFilter(req, file, cb) {
    checkTypeFile(file, cb);
  },
});

/* GET home page. */
router.get("/", (req, res) => {
  let params = {
    TableName: process.env.TABLE_NAME,
  };

  docClient.scan(params, (err, data) => {
    if (err) {
      return res.json("Internal Server Error!");
    } else {
      return res.render("index", { data: data.Items });
    }
  });
});

/* POST create data */
router.post("/", upLoad.single("image"), (req, res) => {
  let { id, price, brand, specific, name } = req.body;
  let image = req.file.originalname.split(".");
  let fileType = image[image.length - 1];
  const filePath = `${uuid() + Date.now().toString()}.${fileType}`;

  let params = {
    Bucket: "iuh-images-bucket",
    Key: filePath,
    Body: req.file.buffer,
  };

  s3.upload(params, (err, data) => {
    if (err) {
      return res.json("Post failed. Please try again !");
    }
    let package = {
      TableName: process.env.TABLE_NAME,
      Item: {
        maMay: id,
        gia: price,
        hang: brand,
        chiTiet: specific,
        ten: name,
        image: `${CLOUD_FRONT_URL + filePath}`,
      },
    };

    docClient.put(package, (err, data) => {
      if (err) {
        return res.json("Update failed. Please try again !");
      }
      return res.redirect("/");
    });
  });
});

/* Delete */
router.get("/delete", (req, res) => {
  let params = {
    TableName: process.env.TABLE_NAME,
    Key: {
      maMay: req.query.id,
    },
  };

  docClient.delete(params, (err, data) => {
    if (err) {
      return res.json(err);
    }
    return res.redirect("/");
  });
});

/* Update */
router.get("/update", (req, res) => {
  const params = {
    TableName: process.env.TABLE_NAME,
    Key: {
      maMay: req.query.id,
    },
  };

  docClient.get(params, (err, data) => {
    if (err) {
      return res.json("Internal server error !");
    }
    return res.render("update", { product: data.Item });
  });
});

router.post("/update", async (req, res) => {
  let { id, price, brand, specific, name } = req.query;

  const params = {
    TableName: process.env.TABLE_NAME,
    Key: {
      maMay: id,
    },
    AttributeUpdates: {
      gia: price + 1,
      hang: brand,
      chiTiet: specific,
      ten: name,
    },
  };

  await docClient.update(params, (err, data) => {
    if (err) {
      return res.json(err);
    }
    return res.redirect("/");
  });
});
module.exports = router;
