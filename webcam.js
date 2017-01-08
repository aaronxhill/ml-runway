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

        webshot(info.snapshot_url, 'now.png', ssOptions, function(err) {
            if (err) {
                console.log(err);
            }
            else {
                var imagemin = require('imagemin');
                var imageminMozjpeg = require('imagemin-mozjpeg');
                var imageminPngquant = require('imagemin-pngquant');
                 
                imagemin(['now.png'], 'build/images', {
                    plugins: [
                        imageminMozjpeg({targa: true}),
                        imageminPngquant({quality: '65-80'})
                    ]
                }).then(files => {
                    fs.writeFile('now-min.png', files[0].data, (err) => {
                        if (err) throw err;
                        console.log('done');
                    });
                });

            }

        }); // webshot 

        // else {console.log('Request error: Response status code: ', response.statusCode, 'Error: ', error);}

    } // if error
    else {
        console.log('no go', JSON.stringify(response));
        // console.log('NOT LOGGED! Response status code: ', response.statusCode, 'Error: ', error);
    }
}


// ITERATE

function iterator() {
    console.log(process.env.RUNWAY_URL);
    request(nestOptions, processResponse);
}

setInterval(iterator, 10000);
