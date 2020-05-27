

import {
    getChannelFromTokenUrl,
    getChannelFromUsherUrl,
    appendAllowAudioOnly,
    getAudioOnlyUrl,
    buildUsherUrl 
} from "./url_utils";
import {fetchContent, fetchJson} from "./fetch";
import UsherUrl from "./usher_url";

var accessTokenUrlMap: Map<string, string> = new Map();  // map of channel(string) to url(string)
var usherUrlMap: Map<string, UsherUrl> = new Map();  // map of channel(string) to {url:string, expiresAt: number}


async function getAudioStreamUrl(channel: string) : Promise<string> {
    const usherUrl = await getUsherUrl(channel);
    const content = await fetchContent(usherUrl);
    const streamUrl = getAudioOnlyUrl(content);
    return streamUrl;
}


function parseQueryString(url: string) {
    const startIndex = url.indexOf("?");
    const queryStrings = url.substring(startIndex + 1);
    const splited = queryStrings.split("&");
    
    let queryStringArray: string[][] = [];
    splited.forEach(function(item) {
        const itemSplited = item.split("=");
        if(itemSplited) queryStringArray.push(itemSplited);
    })
    return queryStringArray;
}


function getExpirationTime(tokenString: string) {
    try {
        const tokenJson = JSON.parse(tokenString);
        return tokenJson.expires;
    }
    catch(err) {
        console.log("Could not get token expiration time from " + tokenString);
    }
    return null;
}

 /**
  * Getting the video url
  * 1. Content script send async requests to background with channelName and callback
  * 2. background checks cache
  *     2-1. If usherUrl does not exist or is expired, check accessTokenUrl
  *         2-1-1. If accessTokenUrl does not exist, Callback with null
  *         2-1-2. If accessTokenUrl exists, call the url to get token
  *             2-1-2-1. If the call to accessTokenUrl succeeds:
  *                 2-1-2-1-1. Parse the token to get expiration time
  *                 2-1-2-1-2. Build usherUrl with allow_audio_only=true
  *                 2-1-2-1-3. Store the new usherUrl and expiration time to cache
  *                 2-1-2-1-4. Callback with the new usherUrl
  *             2-1-2-2. If the call to accessTokenUrl fails:
  *                 2-1-2-2-1. Log the reason
  *                 2-1-2-2-2. Callback with null
  *     2-2. If usherUrl exists and is not expired, callback with it.
  */
async function getUsherUrl(channel: string) : Promise<string> {
    // Check if there is a cached version
    let usherProp = usherUrlMap.get(channel);
    if(usherProp) {
        const now = new Date();
        const secondsSinceEpoch = Math.round(now.getTime() / 1000);
        // 60 seconds buffer before token expiration
        if(usherProp.expiresAt < secondsSinceEpoch - 60) return usherProp.url;
    }
    // Cached usherUrl expired or does not exist
    const tokenUrl = accessTokenUrlMap.get(channel);
    if(!tokenUrl) {
        console.log("Access token URL is not found for channel " + channel);
        return null;
    }

    const respJson = fetchJson(tokenUrl);
    respJson.then(function(respJsonObj) {
        const expiresAt = getExpirationTime(respJsonObj.token);
        if(expiresAt) {
            const url = buildUsherUrl(channel, respJsonObj.token, respJsonObj.sig, random_number);
            usherUrlMap.set(channel, usherUrl);
            return url;
        }
        return null;
    });
}


chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.message == "get_audio_url") {
            if(request.channel) {
                const audioStreamUrl = getAudioStreamUrl(request.channel);
                sendResponse({audioStreamUrl: audioStreamUrl});
                return;
            }        
            // TODO: Channel name may not be available for livestream in the main page
            console.log("Twitch channel name is not included in the request");
        }
        else {
            console.log("What message is this?" + JSON.stringify(request));
        }
        sendResponse({audioStreamUrl: null});
    }
);


chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        let channelName = getChannelFromTokenUrl(details.url);
        console.log("Token request: " + details.url)
        if(channelName) {
            accessTokenUrlMap[channelName] = details.url;
        }
    },
    {urls: ["*://api.twitch.tv/api/channels/*/access_token*"]}
);


chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        console.log("Usher request: " + details.url);
        const usherUrlObj = new UsherUrl(details.url);
        const newUsherUrl = appendAllowAudioOnly(details.url);
        // const 
        // Update usherUrlMap after getting token expiration date
        const queryStringMap = parseQueryString(newUsherUrl);
        let tokenValue = null;
        for(let [key, value] of queryStringMap) {
            if(key == "token") {
                tokenValue = value;
                break;
            }
        }
        const expiresAt = getExpirationTime(tokenValue);
        const channel = getChannelFromUsherUrl(details.url);
        usherUrlMap[channel] = {url: url, expiresAt: expiresAt};
    },
    {urls: ["*://usher.ttvnw.net/*"]}
);