var fs = require('fs');
var request = require('request');
var webshot = require('webshot');
var AWS = require('aws-sdk');
var winston = require('winston');

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
    if (!error && response.statusCode == 200) {
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
                    console.log(err)
                }
                var foto = fs.createReadStream('temp.png');
                s3bucket.upload({
                    Key: info.last_event.start_time.replace('.', '_'),
                    Body: foto
                }, function(err, data) {
                    if (err) {
                        console.log(err);
                    }
                    else {
                        winston.info("uploaded new image: ", info.last_event.start_time);
                        saveIndex();
                    }
                });
            });


        }
        // else {winston.info('HA CHA! Response status code: ', response.statusCode, 'Error: ', error);}


    }
    else {
        winston.info('NOT LOGGED! Response status code: ', response.statusCode, 'Error: ', error);
    }
}

// VIEWER IN S3
function saveIndex() {
    var params = {
        Bucket: 'ml-runway' /* required */
            //   ContinuationToken: 'STRING_VALUE',
            //   Delimiter: 'STRING_VALUE',
            //   EncodingType: 'url',
            //   FetchOwner: true || false,
            //   MaxKeys: 10
            //   Prefix: 'STRING_VALUE',
            //   StartAfter: 'STRING_VALUE'
    };
    
                var s3bucket = new AWS.S3({
                params: {
                    Bucket: 'ml-runway'
                }
            });

    s3bucket.listObjectsV2(params, function(err, data) {
        if (err) {
            console.log(err);
        }
        else {
            var toWrite = '<!doctype html><html><head><title>Hello, S3!</title><meta name="description" content="S3"><meta charset="utf-8"></head><body>';
            for (var i = 1; i < data.Contents.length + 1; i++) {
                if (data.Contents[data.Contents.length - i].Key != 'index.html') {
                    toWrite = toWrite + "<img src='http://ml-runway.s3-website-us-east-1.amazonaws.com/" + data.Contents[data.Contents.length - i].Key + "'/>";
                }
            }
        }
        toWrite = toWrite + "</body></html>"
        s3bucket.upload({
            Key: 'index.html',
            Body: toWrite,
            ContentType: 'text/html'
        }, function(err, data) {
            if (err) {
                console.log(err);
            }
            else {
                // winston.info("uploaded new image: ", info.last_event.start_time);
            }
        });
    });

}

// ITERATE

function iterator() {
    request(nestOptions, processResponse);
}

setInterval(iterator, 30000);