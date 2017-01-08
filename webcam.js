var fs = require('fs');
var request = require('request');
var webshot = require('webshot');
var AWS = require('aws-sdk');

// OPTIONS

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

        console.log(JSON.stringify(info));

        // webshot(info.last_event.image_url, 'now.png', ssOptions, function(err) {
        //     if (err) {
        //         console.log(err);
        //     }

        // }); // webshot 

        // else {console.log('Request error: Response status code: ', response.statusCode, 'Error: ', error);}

    } // if error
    else {
        console.log('no go', JSON.stringify(response));
        // console.log('NOT LOGGED! Response status code: ', response.statusCode, 'Error: ', error);
    }
}


// ITERATE

function iterator() {
    request(nestOptions, processResponse);
}

setInterval(iterator, 10000);