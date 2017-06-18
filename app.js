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
    if (error) {winston.info("Error, top level processResponse: ", error)}
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
                        winston.info("uploaded new image: ", info.last_event.start_time);
                        // saveIndex();
			// AI AND EMAIL AND MMS
			if ((new Date() - serverStart) > 120000) {
				getLabels(info.last_event.start_time.replace('.', '_'))
                    }
                }});
            });


        }
    }
    else {
        winston.info('NOT LOGGED! Response status code: ', response.statusCode, 'Error: ', error);
    }
}

// // VIEWER IN S3
// function saveIndex() {
//     var params = {
//         Bucket: 'ml-runway', /* required */
// 	StartAfter: '2017-04-27T16:39:00_960Z'
//     };
    
//                 var s3bucket = new AWS.S3({
//                 params: {
//                     Bucket: 'ml-runway'
//                 }
//             });

//     s3bucket.listObjectsV2(params, function(err, data) {
//         if (err) {
//             console.log(err);
//         }
//         else {
//             var toWrite = '<!doctype html><html><head><title>S3 F$ Runway Photos (20)</title><meta name="F$ runway photos in S3; 20 most recent" content="S3"><meta charset="utf-8"></head><body>';
//             for (var i = 1; i < 22; i++) {
//                 if (data.Contents[data.Contents.length - i].Key != 'index.html') {
//                     toWrite = toWrite + "<img src='http://ml-runway.s3-website-us-east-1.amazonaws.com/" + data.Contents[data.Contents.length - i].Key + "'/>";
//                 }
//             }
//         }
//         toWrite = toWrite + "</body></html>";
//         s3bucket.upload({
//             Key: 'index.html',
//             Body: toWrite,
//             ContentType: 'text/html'
//         }, function(err, data) {
//             if (err) {
//                 console.log(err);
//             }
//             else {
//                 // winston.info("uploaded new image: ", info.last_event.start_time);
//             }
//         });
//     });

// }

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
                    else {maybePlane = true}
                }
                // else if (data.Labels[i].Name == 'Flying') {
                    // hasPlane = true
                // }
            }
            if (hasPlane == true) {
                comm.emailPlane(imageName, true);
                // emailPlane(imageName)
		        comm.sendMms(imageName)
            }
            else if (maybePlane == true) {
                comm.emailPlane(imageName, null);
            }
            else {
                comm.emailPlane(imageName, false);
            }
            // here is where you should insert the new record
            var params = {
                TableName: rekLabels,
                Item:{
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
                } else {
                    winston.info("Added item:", JSON.stringify(data, null, 2));
                }
            });

        }; // successful response
    });
}

// function emailPlane(foto) {
//     var api_key = process.env.MAILGUN_KEY;
//     var domain = 'sandbox47a06ea6aea54b5e9a408e3c2de6a8b7.mailgun.org';
//     var mailgun = require('mailgun-js')({
//         apiKey: api_key,
//         domain: domain
//     });

//     var mail = mailcomposer({
//         from: 'Do Not Reply <postmaster@sandbox47a06ea6aea54b5e9a408e3c2de6a8b7.mailgun.org>',
//         to: 'aaron.hill@me.com',
//         subject: 'Plane at Flying Dollar Airport',
//         text: 'A plane at Flying Dollar Airport! See the image at http://ml-runway.s3-website-us-east-1.amazonaws.com/' + foto,
//         html: '<h3>There is a plane at Flying Dollar Airport!</h3><p><img src="http://ml-runway.s3-website-us-east-1.amazonaws.com/' + foto + '"></img></p>'
//     });

//     mail.build(function(mailBuildError, message) {

//         var dataToSend = {
//             to: 'aaron.hill@me.com',
//             message: message.toString('ascii')
//         };

//         mailgun.messages().sendMime(dataToSend, function(sendError, body) {
//             if (sendError) {
//                 winston.info(sendError);
//                 return;
//             }
//         });
//     });

// }

// TWILIO
// function sendMms (foto) {
// 	var client = require('twilio')(process.env.TWILIO_ACCOUNTSID, process.env.TWILIO_AUTHTOKEN); 
// 	var fotoUrl = "http://ml-runway.s3-website-us-east-1.amazonaws.com/" + foto; 
	
// 		for (var i=0; i<cellNumbers.length; i++) { 
// 			client.messages.create({ 
// 			    to: cellNumbers[i], 
// 			    from: "+19177088720", 
// 			    body: "Flying Dollar has a visitor!", 
// 			    mediaUrl: fotoUrl,  
// 			}, function(err, message) { 
// 			    console.log(message.sid); 
// 			});
// 		}
// }

// ITERATE

function iterator() {
    request(nestOptions, processResponse);
}

setInterval(iterator, 30000);
