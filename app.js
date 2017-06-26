var fs = require('fs');
var request = require('request');
var webshot = require('webshot');
var AWS = require('aws-sdk');
var winston = require('winston');
var mailcomposer = require('mailcomposer');

var serverStart = new Date();

var cellNumbers = JSON.parse(fs.readFileSync('cells.txt'));

var comm = require('./communication');

// OPTIONS

winston.add(
    winston.transports.File, {
        filename: 'info.log',
        level: 'info',
        json: true,
        eol: '\n',
        timestamp: true
    });

winston.log('info', 'Server restarted');

AWS.config.region = 'us-east-1';
var docClient = new AWS.DynamoDB.DocumentClient();

var nestOptions = {
    url: process.env.RUNWAY_URL,
    headers: {
        'Authorization': process.env.RUNWAY_AUTH
    }
};

var ssOptions = {
    shotSize: {
        width: 640,
        height: 360
    }
};

// PROCESS RESPONSE
function processResponse(error, response, body) {
    if (error) {
        winston.info("Error, top level processResponse: ", error)
    }
    else if (!error && response.statusCode == 200) {
        var info = JSON.parse(body);
        if (info.last_event.start_time != process.env.RUNWAY_CAM_LAST) {
            process.env.RUNWAY_CAM_LAST = info.last_event.start_time;

            var s3bucket = new AWS.S3({
                params: {
                    Bucket: 'ml-runway'
                }
            });

            webshot(info.last_event.image_url, 'temp.png', ssOptions, function(err) {
                if (err) {
                    winston.info("WEBSHOT top level error: ", err);
                }
                var foto = fs.createReadStream('temp.png');
                s3bucket.upload({
                    Key: info.last_event.start_time.replace('.', '_'),
                    Body: foto
                }, function(err, data) {
                    if (err) {
                        winston.info("S3 Bucket upload error: ", err);
                    }
                    else {
                        // saveIndex();
                        // AI AND EMAIL AND MMS
                        if ((new Date() - serverStart) > 120000) {
                            getLabels(info.last_event.start_time.replace('.', '_'))
                            winston.info("uploaded new image: ", info.last_event.start_time);
                        }
                    }
                });
            });


        }
    }
    else {
        winston.info('NOT LOGGED! Response status code: ', response.statusCode, 'Error: ', error);
    }
}

// REKOGNITION AND EMAIL
function getLabels(imageName) {

    var rekognition = new AWS.Rekognition({
        region: 'us-east-1'
    });

    var params = {
        Image: {
            S3Object: {
                Bucket: "ml-runway",
                Name: imageName
            }
        },
        MaxLabels: 123,
        MinConfidence: 30
    };
    rekognition.detectLabels(params, function(err, data) {
        if (err) winston.info("TOP LEVEL REK ERROR: ", err, err.stack); // an error occurred
        else {
            // plane logic here
            var hasPlane = false;
            var maybePlane = false;
            for (var i = 0; i < data.Labels.length; i++) {
                if (data.Labels[i].Name == 'Airplane') {
                    if (data.Labels[i].Confidence >= 60) {
                        hasPlane = true
                    }
                    else {
                        maybePlane = true
                    }
                }
                // else if (data.Labels[i].Name == 'Flying') {
                // hasPlane = true
                // }
            }
            if (hasPlane == true) {
                comm.emailPlane(imageName, true);
                comm.sendMms(imageName, cellNumbers)
            }
            else if (maybePlane == true) {
                comm.emailPlane(imageName, null);
            }
            else {
                comm.emailPlane(imageName, false);
            }
            // here is where you should insert the new record
            var params = {
                TableName: 'rekLabels',
                Item: {
                    "imageName": imageName,
                    "awsLabel": hasPlane,
                    "awsMaybe": maybePlane,
                    "userUpdate": false
                }
            };

            // console.log("Adding a new item...");
            docClient.put(params, function(err, data) {
                if (err) {
                    winston.info("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                }
                else {
                    winston.info("Added item:", JSON.stringify(data, null, 2));
                }
            });

        }; // successful response
    });
}

// ITERATE

function iterator() {
    request(nestOptions, processResponse);
}

setInterval(iterator, 30000);
