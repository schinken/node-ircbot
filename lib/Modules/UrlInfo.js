var Entities = require('html-entities').AllHtmlEntities;
var commons = require('../Utils/Common');
var request = require('request');

const MAX_TITLE_LENGTH = 100;
const MAX_BODY_SIZE = 100 * 1024;

class UrlInfo {

    constructor() {
        this.entities = new Entities();
        this.regex = new RegExp('(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])', 'igm');
    }
    setup(irc) {
        this.irc = irc;
        this.irc.onMessage(this.onMessage.bind(this));
    }

    onMessage(channel, nickname, message, isQuery) {

        if (isQuery) {
            return false;
        }

        var m = message.match(this.regex);
        if (m) {
            m.forEach((url) => {
                this.retrieveTitle(url, (error, title) => {

                    if (error) {
                        return false;
                    }

                    this.irc.say('UrlInfo: ' + title);
                });
            });
        }
    }

    retrieveTitle(url, callback) {
        url = UrlInfo.sanitizeUrl(url);

        let body = '';
        let r = request.get(url, (error, response, body) => {
            if (error) {
                return callback(error);
            }
        });

        r.on('response', function(response) {
            const statusCode = response.statusCode;
            const contentType = response.headers['content-type'];

            let error = null;
            if (statusCode !== 200) {
                error = new Error('Status-Code: ' + statusCode);
            } else if (!/^text\/html/.test(contentType)) {
                error = new Error('Content-Type: ' + contentType);
            }

            if (error) {
                r.abort();
                return callback(error);
            }
        });

        r.on('data', (data) => {
            body += data;

            if (body.length > MAX_BODY_SIZE || body.indexOf('</title>') !== -1) {
                r.abort();
            }
        });

        r.on('end', () => {
            if (!body) {
                return callback(new Error('Body is empty'));
            }

            let m = body.match(/<title>([^<]+)<\/title>/);
            if (!m) {
                return callback(new Error('Can\'t find title'));
            }

            let title = this.entities.decode(m[1]).trim();
            return callback(null, commons.ellipsis(title, MAX_TITLE_LENGTH));
        });
    }

    static sanitizeUrl(url) {
        if (!url.match(/^https?:\/\//)) {
            return 'http://' + url;
        }

        return url;
    }

}

module.exports = UrlInfo;