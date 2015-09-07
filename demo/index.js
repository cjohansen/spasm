var fs = require('fs');
var browserify = require('browserify-middleware');
var express = require('express');
var app = express();

browserify.settings({transform: ['babelify']});

app.use('/scripts', browserify(__dirname + '/scripts'));

app.get('/vendor/react.js', function (req, res) {
  res.send(fs.readFileSync(__dirname + '/../node_modules/react/dist/react-with-addons.js', 'utf-8'));
});

app.get('*', function (req, res) {
  res.send(fs.readFileSync(__dirname + '/index.html', 'utf-8'));
});

app.listen(10666, function () {
  console.log('Reapp demo available at http://localhost:10666/');
});
