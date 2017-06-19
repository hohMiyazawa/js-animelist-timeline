/**
 * MIT licenced
 *
 * v0.1.1
 * 2017-04-06
 */

/*
 *
 * code outline:
 *
 * imports
 * global data
 * page load
 * main chain
 * feedback
 * types
 * buttons
 * util
 * data cleaning
 * url query manipulation
 * api urls
 * test(ing) stuff
 *
 */


//
// imports
//

//import animelistTL.ts
import {AnimeListTimeline} from "./src/animelistTL";
import {AnimeListTimelineConfig} from "./src/animelistTL";
import {NoDatedAnimeError} from "./src/animelistTL";

//import MAL.ts
import * as MAL from "./src/MAL";

//import timeline.ts
import {Timeline} from "./lib/timeline";


//import jquery
import * as $ from "jquery";

//import FileSaver.js
import FileSaver = require('./lib/FileSaver');
declare function saveAs(foo?, fooo?);
console.info("init FileSaver???");
console.info(FileSaver);
console.info(saveAs);

// Deprecated or something?
declare function unescape(s: string): string;


//
// Global data
//

export const debug: boolean = false;
// export const debug: boolean = true

export const usingTestData: boolean = false;
// export const usingTestData: boolean = true

if (debug || usingTestData) {
    console.warn("Don't commit debug!");
}

//
//

const testData: string = "res/malappinfo.xml";

const siteUrl: string = "https://linkviii.github.io/js-animelist-timeline/";
const repoUrl: string = "https://github.com/linkviii/js-animelist-timeline";
const issueUrl: string = "https://github.com/linkviii/js-animelist-timeline/issues";

const dateRegex = /^\d\d\d\d[\-\/.]\d\d[\-\/\.]\d\d$|^\d\d\d\d\d\d\d\d$/;


const userCache: Map<string, MAL.AnimeList | MAL.BadUsernameError> = new Map();
let timelineCount: number = 0;


// global for ease of testing. Used as globals.
let uname: string;
let tln: AnimeListTimeline;

//
// Page load
//

function init(): void {

    // form fields
    const param = getJsonFromUrl();

    const listField = $("#listName");
    listField.select();

    if (param["uname"]) {
        listField.val(param["uname"]);
    }
    if (param["width"]) {
        $("#width").val(param["width"]);
    }
    if (param["minDate"]) {
        $("#from").val(param["minDate"]);
    }
    if (param["maxDate"]) {
        $("#to").val(param["maxDate"]);
    }

    //buttons
    $("#listFormSubmit")[0].addEventListener("click", listFormSubmit);

    const removeAll = <HTMLButtonElement> document.getElementById("clearAllTimelines");
    removeAll.disabled = true;
    removeAll.addEventListener("click", clearAllTimelines);

}


$(document).ready(init);


//
// main chain
//

// main I
// Entry point from html form
function listFormSubmit(): void {
    beforeAjax();
    return;
}

// main II
// Form api requests and call
function beforeAjax(): void {
    uname = $("#listName").val().trim();

    if (usingTestData) {
        console.info("Using test data");
        let doc = loadTestData(testData);//ajax
        afterAjax(doc);
        return
    }

    if (uname == "") {
        reportNoUser();
        return;
    }

    // check cache for name
    // to skip ajax
    const data: MAL.AnimeList | MAL.BadUsernameError = userCache.get(uname);
    if (data) {
        console.info([uname, "'s data loaded from cache."].join(""));
        if (data instanceof MAL.AnimeList) {
            prepareTimeline(data);
        } else {
            reportBadUser();
        }
        return;
    }


    const malUrl: string = getMalApiUrl(uname);
    //document.getElementById("inputOut").innerHTML = malUrl;//debug

    const yqlURL: string = getYqlUrl(malUrl);

    $.getJSON(yqlURL, ajaxData);

}

// main III
// Transform yql response into an xml document
function ajaxData(data): void {
    const thing = $.parseXML(data.results[0]);
    afterAjax(thing);
}

// main IV
// Wrapper to handle errors in MAL response.
// Currently only a bad username is expected
function afterAjax(doc): void {
    let mal: MAL.AnimeList;

    try {
        mal = new MAL.AnimeList(doc); // can throw BadUsernameError
        userCache.set(uname, mal);

    } catch (err) {
        if (err instanceof MAL.BadUsernameError) {
            userCache.set(uname, err);
            reportBadUser();
            return;
        } else {
            throw err;
        }
    }

    prepareTimeline(mal);
}

// main V
// Use doc to build timeline
function prepareTimeline(mal: MAL.AnimeList): void {

    let startDate: string = $("#from").val().trim();
    let endDate: string = $("#to").val().trim();


    startDate = fixDate(startDate, -1);
    endDate = fixDate(endDate, 1);


    const widthStr: string = $("#width").val().trim();

    let width: number;
    if (isNormalInteger(widthStr)) {
        width = parseInt(widthStr);
    } else {//default
        width = 1000;
    }

    const tlConfig: AnimeListTimelineConfig = {
        width: width, minDate: startDate, maxDate: endDate
    };

    updateUri(tlConfig);

    try {
        //global
        tln = new AnimeListTimeline(mal, tlConfig); // can throw NoDatedAnimeError

    } catch (err) {
        if (err instanceof NoDatedAnimeError) {
            reportNoDated();
            return;
        } else {
            throw err;
        }
    }

    displayTimeline();
}

// main VI
// write the timeline to the document
// pre: tln is a valid AnimeListTimeline object
function displayTimeline(): void {

    /*
     This comment could lie
     and so could any other

     `` div #tls
     ``** div
     ``**`` ul buttonlist
     ``**``** li
     ``**``**`` button
     ``**`` div .tl_[n]
     ``**```` svg

     ** → multiple
     `` → single

     */


    //Allways add new timeline on top
    const tlArea = document.createElement("div");
    $("#tls").prepend(tlArea);


    //make buttons
    const removeButton = document.createElement("button");
    removeButton.textContent = "X";
    removeButton.setAttribute("title", "Remove timeline from the page");
    removeButton.addEventListener("click", removeTl);

    const svgButton: MyButton = document.createElement("button");
    svgButton.textContent = "S";
    svgButton.setAttribute("title", "Save as svg");
    svgButton.addEventListener("click", exportTimeline);
    svgButton.kind = exportType.Svg;

    const pngButton: MyButton = document.createElement("button");
    pngButton.textContent = "P";
    pngButton.setAttribute("title", "Save as png");
    pngButton.addEventListener("click", exportTimeline);
    pngButton.kind = exportType.Png;

    const jsonButton: MyButton = document.createElement("button");
    jsonButton.textContent = "J";
    jsonButton.setAttribute("title", "Save tln json");
    jsonButton.addEventListener("click", exportTimeline);
    jsonButton.kind = exportType.Json;

    //make list
    const controls = document.createElement("ul");
    controls.className = "buttonList";
    controls.appendChild(wrapListItem(removeButton));
    controls.appendChild(wrapListItem(svgButton));
    controls.appendChild(wrapListItem(pngButton));
    if (debug) {
        controls.appendChild(wrapListItem(jsonButton));
    }


    //make timeline container
    const tl: MyContainer = document.createElement("div");
    tl.className = "timeline";
    tl.id = "tl_" + timelineCount;
    timelineCount++;

    tl.meta = tln;

    // add to dom
    tlArea.appendChild(controls);
    tlArea.appendChild(tl);

    //make timeline after it has a valid anchor in the doc
    const svg: Timeline = new Timeline(tln.data, tl.id);
    svg.build();

    const removeAll = <HTMLButtonElement> document.getElementById("clearAllTimelines");
    removeAll.disabled = false;
}

// ***
// End main chain
// ***

//
// feedback
//


function reportNoUser() {
    usernameFeedback("No username given.");
}

function reportBadUser(): void {
    usernameFeedback(uname + " is not a valid MAL username.");
}

function reportNoDated() {
    const str = ["None of the anime in the list contained watched dates. ",
        "Try removing date filters. ",
        "If the list does contain watched dates and you see this error, please report an issue at ",
        issueUrl]
        .join("");
    giveFeedback(str, 14);
}

function usernameFeedback(str: string) {
    giveFeedback(str);
    $("#listName").select();
}

function giveFeedback(str: string, sec = 5) {

    const time = sec * 1000;

    const feedback = $("#feedback");
    feedback.text(str);
    // feedback[0].textContent = str;
    setTimeout(function () {
        feedback.text("");
    }, time);

}


//
// types
//

enum exportType {
    Png,
    Svg,
    Json
}

class MyButton extends HTMLButtonElement {
    kind?: exportType;
}

class MyContainer extends HTMLDivElement {
    meta?: AnimeListTimeline;
}


//
// Buttons (other than submit)
//


// "Remove all" button
function clearAllTimelines(): void {
    this.disabled = true;
    $("#tls").empty();
}

//button listeners. `this` is the button

// "X" button
function removeTl() {
    //rm ../../.. → div {ul, div#tl_}
    this.parentElement.parentElement.parentElement.remove();
    // to do? disable remove all if there are no more timelines
}

// "P" | "S" button
function exportTimeline() {
    //div = ../../.. → div {ul, div#tl_}
    //svg = div/div#tl_/svg
    const div = this.parentElement.parentElement.parentElement;
    const container: MyContainer = div.getElementsByClassName("timeline")[0];
    const svg = container.firstElementChild;

    const fileName: string = container.meta.getDescriptor();

    const svgdata = new XMLSerializer().serializeToString(svg);

    switch (this.kind) {
        //
        case exportType.Png: {
            const img = document.createElement("img");
            img.setAttribute("src", "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgdata))));

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            const svgSize = svg.getBoundingClientRect();
            canvas.width = svgSize.width * 3;
            canvas.height = svgSize.height * 3;

            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            img.onload = function () {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(function (blob) {
                    saveAs(blob, fileName + ".png");
                });
            };

        }
            break;
        //
        case exportType.Svg: {

            const blob = new Blob([svgdata], {type: "image/svg+xml"});
            saveAs(blob, fileName + ".svg");
        }
            break;

        case exportType.Json: {

            const blob = new Blob([container.meta.getJson()], {type: "application/json"});
            saveAs(blob, fileName + ".json");
        }
            break;

        //
        default: {
            console.error("unhandled export case");
        }
    }

}


//
// Util
//

function wrapListItem(elm: Element) {
    const li = document.createElement("li");
    li.appendChild(elm);
    return li;
}

//
// Data cleaning
//

/**
 * Returns if the string represents a non negative integer.
 * @param str
 * @returns {boolean}
 */
function isNormalInteger(str: string): boolean {
    const n: number = ~~Number(str);
    return (String(n) === str) && (n >= 0);
}

//make user input suitible for anime timeline
//must not be null
function fixDate(date: string, minmax: -1 | 1): string {

    const minYear = 1980;//Nerds can change this in the future
    const maxYear = 2030;//For now its sane

    const test: boolean = dateRegex.test(date);
    if (!test) {
        date = MAL.rawNullDate;
    }
    let ys: string;
    let ms: string;
    let ds: string;
    if (/^\d\d\d\d\d\d\d\d$/.test(date)) {
        ys = date.slice(0, 4);
        ms = date.slice(4, 6);
        ds = date.slice(6, 8);
    } else {
        ys = date.slice(0, 4);
        ms = date.slice(5, 7);
        ds = date.slice(8, 10);
    }
    const y: number = parseInt(ys);
    const m: number = parseInt(ms);
    const d: number = parseInt(ds);

    //A date needs at least a sane year
    if (y < minYear || y > maxYear) {
        if (minmax == -1)
            ys = minYear.toString();
        else // (minmax == 1)
            ys = maxYear.toString();

    }
    if (m < 0 || m > 12) {
        ms = "00";
    }
    if (d < 0 || d > 32) {
        ds = "00";
    }

    return [ys, ms, ds].join("-")
}


//
// url query manipulation
//

//http://stackoverflow.com/a/8486188/1993919
function getJsonFromUrl(hashBased?): any {
    let query;
    if (hashBased) {
        let pos = location.href.indexOf("?");
        if (pos == -1) return [];
        query = location.href.substr(pos + 1);
    } else {
        query = location.search.substr(1);
    }
    const result = {};
    query.split("&").forEach(function (part) {
        if (!part) return;
        part = part.split("+").join(" "); // replace every + with space, regexp-free version
        const eq = part.indexOf("=");
        let key = eq > -1 ? part.substr(0, eq) : part;
        const val = eq > -1 ? decodeURIComponent(part.substr(eq + 1)) : "";
        const from = key.indexOf("[");
        if (from == -1) result[decodeURIComponent(key)] = val;
        else {
            const to = key.indexOf("]");
            const index = decodeURIComponent(key.substring(from + 1, to));
            key = decodeURIComponent(key.substring(0, from));
            if (!result[key]) result[key] = [];
            if (!index) result[key].push(val);
            else result[key][index] = val;
        }
    });
    return result;
}

//http://stackoverflow.com/a/19472410/1993919
function replaceQueryParam(param: string, newval: string, search: string): string {
    // Could default but probably not intended.
    //search = search || window.location.search;

    const regex = new RegExp("([?;&])" + param + "[^&;]*[;&]?");
    const query = search.replace(regex, "$1").replace(/&$/, '');

    return (query.length > 2 ? query + "&" : "?") + (newval ? param + "=" + newval : '');
}

function updateUri(param: AnimeListTimelineConfig): void {

    let startDate: string = $("#from").val().trim();
    if (startDate == "") {
        startDate = "";
    }
    let endDate: string = $("#to").val().trim();
    if (endDate == "") {
        endDate = "";
    }

    let str = window.location.search;

    str = replaceQueryParam("uname", uname, str);
    str = replaceQueryParam("width", param.width.toString(), str);
    str = replaceQueryParam("minDate", startDate, str);
    str = replaceQueryParam("maxDate", endDate, str);

    window.history.replaceState(null, null, str);
}

//
// API urls
//

/**
 * Forms MAL API URL based on username.
 * @param name
 * @returns {string}
 */
function getMalApiUrl(name: string): string {
    const malUrlBase: string = "http://myanimelist.net/malappinfo.php?u=";
    const malUrlFilter: string = "&status=all&type=anime";

    return malUrlBase + name + malUrlFilter;
}


/**
 * Forms YQL URL based on MAL URL.
 * YQL is used to proxy the xml request as json.
 * @param malUrl
 * @returns {string}
 */
function getYqlUrl(malUrl: string): string {
    const yqlUrlBase: string = "https://query.yahooapis.com/v1/public/yql";
    const q: string = "?q=";
    const query: string = "select * from xml where url='" + malUrl + "'";
    const encodedQuery = encodeURIComponent(query);
    const yqlUrlFilter: string = "&format=xml&callback=?";

    const yqlUrl: string = [yqlUrlBase, q, encodedQuery, yqlUrlFilter].join("");

    return yqlUrl;
}

//
// test(ing) stuff
//

// load xml not async
function loadTestData(url: string): any /*xml*/ {
    return (function () {
        let xml = null;
        $.ajax({
            async: false,

            crossDomain: true,

            global: false,
            url: url,
            dataType: "xml",
            success: function (data) {
                xml = data;
            }
        });
        return xml;
    })();
}