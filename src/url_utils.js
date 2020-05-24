
const twitchDomain = "twitch.tv/"
// Non-exhuastive list of non-channel routes in twitch.tv
const nonChannels = ["directory", "videos", "u", "settings"];

const apiDomain = "api.twitch.tv/api/channels/";
const accessToken = "/access_token";

const usherDomain = "usher.ttvnw.net/api/channel/hls/";
const usherExt = ".m3u8"


// TODO: Instead of pre-defined url format, use recently used ont in Twitch web
export function buildUsherUrl(channel, token, sig, random_number) {
    const url = `http://usher.twitch.tv/api/channel/hls/{channel}.m3u8?player=twitchweb&token={token}&sig={sig}&allow_audio_only=true&allow_source=true&type=any&p={random_number}`;
    return url;
}


// If necessary, append allow_audio_only=1 query string at the end of URL
export function appendAllowAudioOnly(usherUrl) {
    // TODO: the function always appends the querystring at the end.
    // It needs to fully parse the url and append/replace only when necessary.
    return usherUrl + "&allow_audio_only=1";
}


// Extract audio_only stream .m3u8 from the master playlist content.
// Returns the first occurance of a URL after audio_only metadata.
// TODO: This works, but eventually we will need to fully parse the content
// and get audio_only stream url
export function getAudioOnlyUrl(content) {
    if(!content) {
        return null;
    }
    const lines = content.split('\n');
    let audioOnlyFound = false;
    lines.forEach(line => {
        if (line.includes("audio_only")) audioOnlyFound = true;
        if (audioOnlyFound && line.startsWith("https://")) return line;
    });
    return null;
}


export function getChannelFromWebUrl() {
    // Channel name may not be available from the main page URL
    const url = location.href;
    const channel = getNameBetweenStrings(url, twitchDomain, "/", true);
    console.log("Channel name " + channel + ", from URL: " + url)

    // Filter out some non-channel pages with similar URL pattern as channel pages
    if (channel in nonChannels) return null;
    return channel;
}


export function getChannelFromTokenUrl(accessTokenUrl) {
    const channel = getNameBetweenStrings(accessTokenUrl, apiDomain, accessToken);
    console.log("channel name parsed access token: " + channel);
    return channel;
}


export function getChannelFromUsherUrl(usherUrl) {
    const channel = getNameBetweenStrings(usherUrl, usherDomain, usherExt);
    console.log("channel name parsed usher: " + channel);
    return channel;
}


// Get channel between the first occurance of startStr and the first endStr after startStr.
function getNameBetweenStrings(url, startStr, endStr, endOptional=false) {
    let startIndex = url.indexOf(startStr);
    if(startIndex == -1) {
        return null;
    }
    startIndex += startStr.length;

    let endIndex = url.indexOf(endStr, startIndex + 1);
    if(endIndex == -1) {
        if(endOptional) endIndex = url.length;
        else return null;
    }
    return url.substring(startIndex, endIndex);
}


export function parseQueryString(url) {
    const startIndex = url.indexOf("?");
    const queryStrings = url.substring(startIndex + 1);
    const splited = queryStrings.split("&");
    
    let parsed = {};
    splited.forEach(function(item) {
        const itemSplited = item.split("=");
        if(itemSplited) {
            parsed[itemSplited[0]] = itemSplited[1];
        }
    })
    return parsed;
}