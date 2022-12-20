/* eslint-disable camelcase */
/* eslint-disable curly */
// ==UserScript==
// @name         WME Fancy Permalinks
// @namespace    WazeDev
// @version      2022.12.19.002
// @description  Fancy permalinks for the Waze Map Editor
// @author       dummyd2, maintained by many others
// @license      TBD....
// @match         *://*.waze.com/*editor*
// @exclude       *://*.waze.com/user/editor*
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_getResourceURL
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // const IS_DEBUG = false;
    const NO_LAYER_MODE = true;
    const IS_MAC = false;

    /* helper function */
    // function getElementsByClassName(classname, node) {
    //     if (!node) {
    //         [node] = document.getElementsByTagName('body');
    //     }
    //     const a = [];
    //     const re = new RegExp(`\\b${classname}\\b`);
    //     const els = node.getElementsByTagName('*');
    //     for (let i = 0, j = els.length; i < j; i++)
    //         if (re.test(els[i].className))
    //             a.push(els[i]);
    //     return a;
    // }

    function getElementById(node) {
        return document.getElementById(node);
    }

    // function WMETB_FPlogBeta(msg, obj) {
    //     // log("Beta - " + msg, obj);
    // }

    // function WMETB_FPlogDebug(msg, obj) {
    //     if (IS_DEBUG) WMETB_FPlog(`DEBUG - ${msg}`, obj);
    // }

    function log(msg) {
        console.log('Fancy Permalink:', msg);
    }

    function WMETB_FPgetFunctionWithArgs(func, args) {
        return (
            function () {
                const json_args = JSON.stringify(args);
                return function () {
                    args = JSON.parse(json_args);
                    func.apply(this, args);
                };
            }
        )();
    }

    function WMETB_FPwaitForObject(varName) {
        var objPath = varName.split('.');
        var obj = window;
        for (var i = 0; i < objPath; i++) {
            if (obj.hasOwnProperty(objPath[i]))
                obj = obj[objPath[i]];
            else
                return false;
        }
        return true;
        /*
        var obj=null;
        obj=e/val("typeof(" + varName + ")");
        if(obj === "undefined") {
        WMETB_FPlog(varName + ' KO');
        window.setTimeout(WMETB_FPwaitForObject.caller, 500);
        return false;
        }
        WMETB_FPlogBeta(varName + ' OK');
        if (shortcutName!=null)
        e/val (shortcutName + "=" + varName);
        return true;
         */
    }

    function WMETB_FPinitializeWazeObjects() {
        /* if (typeof unsafeWindow === "undefined") { // || ! bGreasemonkeyServiceDefined)
        unsafeWindow    = ( function () {
        var dummyElem = document.createElement('p');
        dummyElem.setAttribute('onclick', 'return window;');
        return dummyElem.onclick();
        }) ();
        } */
        var objectToCheck = ['Waze', 'W.model', 'W.map', 'W.model.chat', 'W.loginManager', 'W.selectionManager', 'W.Config.api_base', 'W.loginManager.user', 'localStorage', 'navigator', 'W.loginManager.user.rank'];
        for (var i = 0; i < objectToCheck.length; i++) {
            if (!WMETB_FPwaitForObject(objectToCheck[i]))
                return;
        }
        WMETB_FPinitialiseFP();
    }

    function WMETB_FPinitialiseFP() {
        const wmefplinks = getElementById('WMEFP-links');

        if (wmefplinks != null) return;

        const [mapFooter] = document.getElementsByClassName('WazeControlPermalink');
        if (!mapFooter) {
            log("error: can't find permalink container");
            setTimeout(WMETB_FPinitialiseFP, 1000);
            return;
        }

        // WMETB_FPdivPerma = mapFooter[0].children[0];
        [WMETB_FPaPerma] = document.getElementsByClassName('permalink hidden');

        // var FPfooterclass = 'permalink hidden';

        // bug fix with house number helper... :X
        // for (var i = 0; i < WMETB_FPdivPerma.children.length; i++) {

        //     if (WMETB_FPdivPerma.children[i].className.indexOf(FPfooterclass) >= 0) {
        //         WMETB_FPaPerma = WMETB_FPdivPerma.children[i];
        //         break;
        //     }
        // }

        // WMETB_FPaPerma.style.display = 'none';

        WMETB_FPnodeWMEFP = document.createElement('div');
        WMETB_FPnodeWMEFP.id = 'WMEFP-links';
        // divPerma.parentNode.insertBefore(nodeWMEFP, divPerma.nextSibling);
        var footerContainer = mapFooter.childElementCount === 2 ? mapFooter : mapFooter.children[0];
        footerContainer.appendChild(WMETB_FPnodeWMEFP);
        
        $('#WMEFP-links').css({
            'display': 'inline-block',
            'position': 'relative',
            'margin-left': '10px',

        });

        WMETB_FPcurLink = '';

        W.selectionManager.events.register('selectionchanged', null, WMETB_FPnewSelectionAvailable);

        if (navigator.userAgent.indexOf('Mac OS') > 0)
            IS_MAC = true;

        log('init done.');
        window.setInterval(function () {
            WMETB_FPupdate();
        }, 250);
        window.setInterval(function () {
            WMETB_FPrepairLSlayerFilters();
        }, 60000);
    }

    function WMETB_FPwazeMapAreaToOLPolygons(geometry) {
        // logDebug("WS to OL: ", geometry);
        var polygons = [];
        if (geometry.type == 'Polygon') {
            polygons.push(WMETB_FPlonlatArrayToxyOLPolygons(geometry.coordinates));
            // logDebug("WS to OL type polygon: call", geometry.coordinates);
        }
        if (geometry.type == 'MultiPolygon') {
            for (var p = 0; p < geometry.coordinates.length; p++) {
                // logDebug("WS to OL type multipolygon: call", geometry.coordinates[p]);
                polygons.push(WMETB_FPlonlatArrayToxyOLPolygons(geometry.coordinates[p]));
            }
        }
        return polygons;
    }

    function WMETB_FPlonlatArrayToxyOLPolygons(lontalArray) {
        var ol_polygons = [];

        for (var p = 0; p < lontalArray.length; p++) {
            var ol_points = [];

            for (var pt = 0; pt < lontalArray[p].length - 1; pt++) {
                //            logBeta("lonlatArrayToxyOLPolygons: lonlat: ", lontalArray[p][pt]);
                var xy = OpenLayers.Layer.SphericalMercator.forwardMercator(lontalArray[p][pt][0], lontalArray[p][pt][1]);
                //            logBeta("lonlatArrayToxyOLPolygons: lonlat: " + lontalArray[p][pt][0] + " ; " + lontalArray[p][pt][1]);
                //            logBeta("lonlatArrayToxyOLPolygons: olxy: " + xy.lon + " ; " + xy.lat);
                ol_points.push(new OpenLayers.Geometry.Point(xy.lon, xy.lat));
            }
            ol_polygons.push(new OpenLayers.Geometry.LinearRing(ol_points));
        }
        if (ol_polygons.length >= 1) {
            var ol_linearRing = ol_polygons[0];
            return (new OpenLayers.Geometry.Polygon([ol_linearRing]));
        }
        return null;
    }

    function WMETB_FPgetForumUserIdFromID(wmeUserID) {
        var wazeUser = W.model.users.getObjectById(wmeUserID);
        return (WMETB_FPgetForumUserIdFromNames([wazeUser.userName]));
    }

    function WMETB_FPgetForumUserIdFromNames(userNames) {
        var forumID = -1;
        var forumIDs = [];

        // send a first query to force the forum to auto-log user:
        var xhr3_object = new XMLHttpRequest();
        xhr3_object.addEventListener('readystatechange', function () {}, false);
        xhr3_object.open('GET', 'https://www.waze.com/forum/memberlist.php?username=dummyd2', false);
        xhr3_object.send(null);

        for (var i = 0; i < userNames.length; i++) {
            xhr3_object = new XMLHttpRequest();
            xhr3_object.addEventListener('readystatechange', function () {
                if (xhr3_object.readyState == 4) {
                    var remainingResponse = xhr3_object.responseText;
                    var offset = remainingResponse.indexOf('u=');
                    var userIDs = [];
                    if (offset != -1) {
                        do {
                            // WMETB_FPlog("offset", offset);
                            // WMETB_FPlog("remainingResponse", remainingResponse.substring(0, 30));
                            var i = offset + 2;
                            while (remainingResponse.charCodeAt(i) >= 48 && remainingResponse.charCodeAt(i) <= 57)
                                i++;
                            userIDs.push(remainingResponse.substring(offset + 2, i));
                            remainingResponse = remainingResponse.substring(i);
                            offset = remainingResponse.indexOf('u=');
                        } while (offset != -1);
                    }
                    if (userIDs.length == 0) {
                        forumID = -1; // no match
                    } else if (userIDs.length > 1) {
                        forumID = -2; // multiple match
                    } else
                        forumID = userIDs[0];
                }
            }, false);
            xhr3_object.open('GET', `https://www.waze.com/forum/memberlist.php?username=${  userNames[i]}`, false);
            xhr3_object.send(null);
            forumIDs.push({
                name: userNames[i],
                id: forumID
            });
        }
        return forumIDs;
    }

    function WMETB_FPopenPostDataInNewTab(url, data) {
        var form = document.createElement('form');
        form.target = '_blank';
        form.action = url;
        form.method = 'post';
        form.style.display = 'none';

        for (var k in data) {
            if (data.hasOwnProperty(k)) {
                var input;
                if (k === 'message') {
                    input = document.createElement('textarea');
                } else {
                    input = document.createElement('input');
                }
                input.name = k;
                input.value = data[k];
                input.type = 'hidden';
                form.appendChild(input);
            }
        }
        getElementById('WMEFP-links').appendChild(form);
        form.submit();
        getElementById('WMEFP-links').removeChild(form);
        return true;
    }

    function WMETB_FPgetPerCountrySettings(countryID) {
        if (window.hasOwnProperty('WMETBFP_countrySettings') == false)
            return null;
        if (window.WMETBFP_countrySettings.hasOwnProperty(`${  countryID}`) == false)
            return null;
        return window.WMETBFP_countrySettings[`${  countryID}`];
    }

    function WMETB_FPescapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
    }

    function WMETB_FPpercountrysettings_replacefunc(k, values) {
        log(`matching ${k}`);
        k = k.slice(1, -1);
        var pair = k.split('|');
        var kw = pair[0];
        var defaultValue = '';
        if (pair.length == 2)
            defaultValue = pair[1];

        for (var varName in values) {
            if (!values.hasOwnProperty(varName))
                continue;
            if (kw == varName) {
                if (values[varName] != null)
                    return values[varName];
                else
                    return defaultValue;
            }

            // if not
            var re = new RegExp(`!${  WMETB_FPescapeRegExp(varName)  }#(.*)`);
            var newKw = kw.replace(re, function (m0, m1) {
                    if (values[varName] === null)
                        return m1;
                    return '';
                });
            if (kw != newKw)
                return newKw;

            // if
            re = new RegExp(`${  WMETB_FPescapeRegExp(varName)  }#(.*)`);
            newKw = kw.replace(re, function (m0, m1) {
                    if (values[varName] !== null)
                        return m1;
                    return '';
                });
            if (kw != newKw)
                return newKw;

            if (kw == 'backslash')
                return '\\';
            if (kw == 'apostrophe')
                return "'";

        }
        /*			switch (kw){
        case 'UserName':
        return values.UserName;
        case 'CurrentLockRank':
        return values.CurrentLockRank;
        case 'UserRank':
        return values.UserRank;
        case 'CountryName':
        return (values.CountryName===null?defaultValue:values.CountryName);
        case 'StateName':
        return (values.StateName===null?defaultValue:values.StateName);
        case 'CityName':
        return (values.CityName===null?defaultValue:values.CityName);
        case 'StreetName':
        return (values.StreetName===null?defaultValue:values.StreetName);
        case 'MainStreetName':
        return (values.MainStreetName===null?defaultValue:values.MainStreetName);
        case 'Permalink':
        return values.Permalink;
        case 'NoLayerPermalink':
        return values.NoLayerPermalink;
        case 'backslash':
        return '\\';
        } */
        return '';
    }

    function WMETB_FPcollectInfosFromSelection() {
        var infos = {
            selectionCount: 0,
            isSegment: false,
            isNode: false,
            isVenue: false,
            maxLock: 0,
            isAutoLock: false,
            permalink: '',
            noLayerPermalink: '',
            countryID: 0,
            country: '',
            stateID: 0,
            state: '',
            cityID: 0,
            city: '',
            streetNames: [],
            mainStreetName: ''
        };
        if (W.selectionManager.getSelectedFeatures().length == 0)
            return infos;
        infos.selectionCount = W.selectionManager.getSelectedFeatures().length;
        infos.isNode = W.selectionManager.getSelectedFeatures()[0].model.type == 'node';
        infos.isSegment = W.selectionManager.getSelectedFeatures()[0].model.type == 'segment';
        infos.isVenue = W.selectionManager.getSelectedFeatures()[0].model.type == 'venue';
        var selRanks = [];
        var selLocks = [];
        var selName = [];
        for (var i = 0; i < 6; i++) {
            selRanks[i] = 0;
            selLocks[i] = 0;
        }
        var subSegs = []; // only for nodes
        for (i = 0; i < W.selectionManager.getSelectedFeatures().length; i++) {
            var sel = W.selectionManager.getSelectedFeatures()[i].model;
            var selRank = null;
            var selLock = null;

            if (infos.isNode) {
                for (var ss = 0; ss < sel.attributes.segIDs.length; ss++) {
                    if (W.model.segments.objects.hasOwnProperty(sel.attributes.segIDs[ss]))
                        subSegs.push(W.model.segments.objects[sel.attributes.segIDs[ss]]);
                }
                for (var ss = 0; ss < subSegs.length; ss++) {
                    selRank = subSegs[ss].attributes.rank;
                    selLock = subSegs[ss].attributes.lockRank;
                    if (selLock != null)
                        selLocks[selLock]++;
                    else
                        selRanks[selRank]++;
                }
            } else {
                selRank = sel.attributes.rank;
                selLock = sel.attributes.lockRank;
                if (selLock != null)
                    selLocks[selLock]++;
                else
                    selRanks[selRank]++;
            }

            var sid = null;
            var street = null;
            if (infos.isSegment) {
                sid = sel.attributes.primaryStreetID;
            } else if (infos.isVenue) {
                sid = sel.attributes.streetID;
            } else { // node
                var sameStreetMax = 0;
                for (var ss = 0; ss < subSegs.length; ss++) {
                    if (subSegs[ss].attributes.primaryStreetID != null) {
                        var subStreet = W.model.streets.getObjectById(subSegs[ss].attributes.primaryStreetID);
                        if (subStreet != null && subStreet.name != null && subStreet.name != '') {
                            if (typeof(selName[subStreet.name]) === 'undefined')
                                selName[subStreet.name] = 0;
                            selName[subStreet.name]++;
                            if (selName[subStreet.name] > sameStreetMax) {
                                sameStreetMax = selName[subStreet.name];
                                street = subStreet;
                            }
                        }
                    }
                }

            }
            // WMETB_FPlog("Street ID: " + sid);
            var street = null;
            if (!infos.isNode) {
                if (sid === null)
                    continue;
                if (typeof(sid) != 'undefined' && W.model.streets.objects.hasOwnProperty(sid) == true)
                    street = W.model.streets.getObjectById(sid);
                // WMETB_FPlog("Street: " + street);
                if (infos.isSegment) {
                    if (street.name != null) {
                        if (typeof(selName[street.name]) === 'undefined')
                            selName[street.name] = 0;
                        selName[street.name]++;
                    }
                } else {
                    if (typeof(selName[sel.attributes.name]) === 'undefined')
                        selName[sel.attributes.name] = 0;
                    selName[sel.attributes.name]++;
                }
            }
            // WMETB_FPlog("city: " + city);

            if (street === null)
                continue;
            if (W.model.cities.objects.hasOwnProperty(street.cityID) == false)
                continue;
            var wmeCity = W.model.cities.getObjectById(street.cityID).attributes;
            var wmeState = W.model.states.getObjectById(wmeCity.stateID);
            var wmeCountry = W.model.countries.getObjectById(wmeCity.countryID);
            // WMETB_FPlog("wmeCity: " + wmeCity);
            if (wmeCity.isEmpty == false) {
                infos.cityID = street.cityID;
                infos.city = wmeCity.name;
                infos.stateID = wmeCity.stateID;
                infos.state = wmeState.name;
                infos.countryID = wmeCity.countryID;
                infos.country = wmeCountry.name;
                // WMETB_FPlog("city name: " + city);
            }
        }
        var maxSNcount = 0;
        for (var k in selName) {
            if (selName.hasOwnProperty(k)) {
                if (selName[k] > maxSNcount) {
                    infos.mainStreetName = k;
                    maxSNcount = selName[k];
                }
                infos.streetNames.push(k);
            }
        }

        if (infos.cityID == 0) {
            if (W.model.topCityId != null) {
                infos.cityID = W.model.topCityId;
                infos.city = W.model.cities.getObjectById(infos.cityID).attributes.name;

                infos.stateID = W.model.cities.getObjectById(infos.cityID).attributes.stateID;
                infos.state = W.model.states.getObjectById(infos.stateID).name;
                infos.countryID = W.model.cities.getObjectById(infos.cityID).attributes.countryID;
                infos.country = W.model.countries.getObjectById(infos.countryID).name;
                log(`Map update - City from top city: ${  infos.city}`);
            }
        }
        /*			if (infos.cityID==0){
        for (var i=0; i<W.model.cities.additionalInfo.length; i++) {
        if (W.model.cities.additionalInfo[i].isEmpty)
        continue;
        if (i==0) {
        city=W.model.cities.additionalInfo[i].name;
        cityID=W.model.cities.additionalInfo[i].id;
        stateID = W.model.cities.additionalInfo[i].stateID;
        state = W.model.states.getObjectById(stateID).name;
        countryID = W.model.cities.additionalInfo[i].countryID;
        country = W.model.countries.getObjectById(countryID).name;
        }
        else
        city = city + "/" + W.model.cities.additionalInfo[i].name;
        }
        if (city!=null) {
        WMETB_FPlog("Map update - City from loaded cities: " + city);
        }
        } */
        if (infos.stateID == 0) {
            infos.stateID = W.model.getTopState().id;
            infos.state = W.model.getTopState().name;
        }

        if (infos.countryID == 0) {
            infos.countryID = W.model.getTopCountry().id;
            infos.country = W.model.getTopCountry().name;
        }

        selRank = -1;
        for (var r = 0; r < 6; r++) {
            if (selRanks[r] != 0 && selRank < r)
                selRank = r;
        }
        selLock = -1;
        for (var r = 0; r < 6; r++) {
            if (selLocks[r] != 0 && selLock < r)
                selLock = r;
        }

        if (selRank > selLock) {
            infos.isAutoLock = true;
            infos.maxLock = selRank;
        } else {
            infos.maxLock = selLock;
        }

        infos.permalink = WMETB_FPaPerma.href.replace(/#/g, '');
        if (infos.isNode) { // replace node id by segments in permalink
            var subSegsLocked = [];
            for (var i = 0; i < subSegs.length; i++) {
                if (subSegs[i].attributes.lockRank != null) {
                    if (subSegs[i].attributes.lockRank > W.loginManager.user.rank) {
                        subSegsLocked.push(subSegs[i].attributes.id);
                    }
                } else {
                    if (subSegs[i].attributes.rank > W.loginManager.user.rank) {
                        subSegsLocked.push(subSegs[i].attributes.id);
                    }
                }
            }
            if (subSegsLocked.length != 0) // else: the user forced the request, so we keep the node selection
            {
                log(`subSegs: ${  infos.permalink}`);
                infos.permalink = infos.permalink.replace(/nodes=[^&]*/g, `segments=${  subSegsLocked.join(',')}`)
            }
        }

        var FPConvertBetaPermalinks = JSON.parse(localStorage.getItem('WME_Toolbox_Options'))['ConvertBetaPermalinks'];
        if ((window.location.hostname === 'beta.waze.com') && FPConvertBetaPermalinks) {
            infos.permalink = infos.permalink.replace('beta.waze.com', 'www.waze.com');
        }

        infos.noLayerPermalink = infos.permalink
            infos.noLayerPermalink = WMETB_FPcutLayers(infos.noLayerPermalink);

        return infos;

    }

    //    function WMETB_FPcutLayers(text) {
    // 	      text=text.replace(/layers=[0-9]*/g, '');
    // 	      text=text.replace(/(&|&amp;)mapProblemFilter=(0|1|true|false)/g, '');
    // 	      text=text.replace(/(&|&amp;)mapUpdateRequestFilter=(0|1|true|false)/g, '');
    // 	      text=text.replace(/(&|&amp;)venueFilter=(0|1|true|false)/g, '');
    // 	      text=text.replace(/(&|&amp;)problemsFilter=(0|1|true|false)/g, '');
    // 	      text=text.replace(/(&|&amp;)update_requestsFilter=(0|1|true|false)/g, '');
    // 	      text=text.replace(/(&|&amp;)mode=(0|1|true|false)/g, '');
    // 	      text=text.replace(/&&/g, '&');
    // 	      text=text.replace(/&amp;&amp;/g, '&amp;');

    // 	      return text;
    //    }

    // Cuts off layer elements of PL URLs (as well as malformed elements)
    // Please always copy updates to WMETB_cutLayers in [prod/beta]\Lib_Util.js! BellHouse
    function WMETB_FPcutLayers(text) {
        var matches = text.match(/(?!(?:\?|&))(?:env|lon|lat|zoomLevel|mapUpdateRequest|mapProblem|segments|nodes|venues|cameras|mapComments|mode|majorTrafficEvent|bigJunctions|citys)=.+?(?=(?:&|$))/gi);
        if (matches == null)
            return text;

        text = text.replace(/\?.*/, '');
        text += '?';

        matches.forEach(function (val, index, fullArray) {
            text += `${val  }&`;
        });

        text = text.slice(0, -1);
        return text;
    }

    // Cuts off malformed elements of a PL URL
    function WMETB_FPcurePL(text) {
        var matches = text.match(/(?!(?:\?|&))(?:env|lon|lat|zoomLevel|layers|mapUpdateRequest|mapProblem|segments|nodes|venues|mapProblemFilter|mapUpdateRequestFilter|venueFilter|problemsFilter|update_requestsFilter|mode|cameras|mapComments|s|mode|majorTrafficEvent|bigJunctions|citys)=.+?(?=(?:&|$))/gi);
        if (matches == null)
            return text;

        text = text.replace(/\?.*/, '');
        text += '?';

        matches.forEach(function (val, index, fullArray) {
            text += `${val  }&`;
        });

        text = text.slice(0, -1);
        return text;
    }

    // Repairs malformed PL elements in browser's local storage
    function WMETB_FPrepairLSlayerFilters() {
        // console.log ("WMETB-FP: WMETB_FPrepairLSlayerFilters launched");
        if (JSON.parse(localStorage.WME_Toolbox_Options)['RepairLayerSettings']) {
            if (localStorage.layerFilters) {
                if (!localStorage.togglersState) {  // key present only with new PL format since WME beta 1.29-11
                    var FPLSlayerFilters = JSON.parse(localStorage.getItem('layerFilters'));
                    var FPnewLayerFilters = {};
                    for (var iFilter in FPLSlayerFilters) {
                        if (iFilter.match(/mapProblem|mapUpdateRequest|venue/gi)) {
                            if (FPLSlayerFilters[iFilter].toString().match(/^[0-3]$/)) {
                                FPnewLayerFilters[iFilter] = FPLSlayerFilters[iFilter];
                            }
                        }
                    }
                }
                localStorage.removeItem('layerFilters');
                if (!localStorage.togglersState)
                    localStorage.layerFilters = JSON.stringify(FPnewLayerFilters);
            }
        }
    }

    function WMETB_FPmapupdate() {
        if (W.selectionManager.getSelectedFeatures().length == 0) {
            alert('Select one or more (Ctrl + click) segments or one node or one place');
            return;
        }
        if (W.selectionManager.getSelectedFeatures()[0].model.type != 'segment'
             && W.selectionManager.getSelectedFeatures()[0].model.type != 'venue'
             && W.selectionManager.getSelectedFeatures()[0].model.type != 'node') {
            alert('Map update request only segments, node or place');
            return;
        }

        var infos = WMETB_FPcollectInfosFromSelection();
        // Set subject line
        var subject = `Level${  infos.maxLock + 1  }${infos.isAutoLock ? '(auto)' : '' 
            } Update: ${ 
            WMETB_FPinclcountry[infos.countryID] === 1 ? (infos.country === '' || infos.state === infos.country ? '' : infos.country + ': ') : '' 
            }${infos.state === '' ? '' : infos.state + ' - ' 
            }${infos.city === '' ? '' : infos.city  } ${ 
            infos.streetNames.length == 0 ? '' : '(' + infos.streetNames.join(',') + ')'}`;
        if (infos.countryID == 57) { // Czech Republic
            subject = `[L${  infos.maxLock + 1  }${infos.isAutoLock ? '(auto)' : '' 
                }] ${ 
                WMETB_FPinclcountry[infos.countryID] === 1 ? (infos.country === '' || infos.state === infos.country ? '' : infos.country + ': ') : '' 
                }${infos.state === '' ? '' : infos.state + ' - ' 
                }${infos.city === '' ? '' : infos.city 
                }${infos.streetNames.length == 0 ? '' : ', ' + infos.streetNames.join(',')}`;
        }
        var message = `My Level: ${  W.loginManager.user.rank + 1  }\n` + `Reason for request: ` + `\n\n` + `[url=${  infos.noLayerPermalink  }]Permalink[/url]`;

        var oldForumSettings = true;
        if (typeof(WMETB_FPmapupdate_gform[infos.countryID]) != 'undefined') {
            // google form country
            oldForumSettings = false;
            var googleFormHelper = WMETB_FPmapupdate_gform[infos.countryID];
            var url = googleFormHelper.url;

            if (googleFormHelper.hasOwnProperty('usrName') == true)
                url += `&${  googleFormHelper.usrName.entry  }=${  W.loginManager.user.userName}`;

            if (googleFormHelper.hasOwnProperty('usrRank') == true)
                url += `&${  googleFormHelper.usrRank.entry  }=${  googleFormHelper.usrRank['' + W.loginManager.user.rank]}`;

            // if (countryID==107) // Italy
            //	names += '\nPlease, check the region below!';

            if (googleFormHelper.hasOwnProperty('message') == true)
                url += `&${  googleFormHelper.message.entry  }=${  encodeURI(infos.streetNames.join(','))}`;
            var newLink = infos.noLayerPermalink;
            newLink = newLink.replace(/&/g, '%26');
            newLink = newLink.replace(/\?/g, '%3F');
            newLink = newLink.replace(/=/g, '%3D');
            url += `&${  googleFormHelper.permalink.entry  }=${  newLink}`;

            if (googleFormHelper.hasOwnProperty('updateRequest') == true)
                url += `&${  googleFormHelper.updateRequest.entry  }=${  googleFormHelper.updateRequest.yes}`;

            if (googleFormHelper.hasOwnProperty('requestRank') == true)
                url += `&${  googleFormHelper.requestRank.entry  }=${  googleFormHelper.requestRank['' + infos.maxLock]}`;

            if (infos.countryID == 107) // Italy custom fields
            {
                var lonlat = W.map.getCenter();
                lonlat = OpenLayers.Layer.SphericalMercator.inverseMercator(lonlat.lon, lonlat.lat);
                var region = WMETB_FP_ITALY_getRegion(lonlat.lon, lonlat.lat);
                if (region != null) {
                    url += `&${  googleFormHelper.customField[0].entry  }=${  region}`;
                }
            }
            if (infos.city != '') {
                if (googleFormHelper.hasOwnProperty('cityName') == true)
                    url += `&${  googleFormHelper.cityName.entry  }=${  encodeURI(infos.city)}`;
            }

            if (infos.countryID == 220 || infos.countryID == 28 || infos.countryID == 250 || infos.countryID == 155 || infos.countryID == 164) // Tanzania Botswana Zimbabwe Namibia Nigeria
            {
                url += `&${  googleFormHelper.customField[0].entry  }=${  googleFormHelper.customField[0][infos.countryID]}`; // add country
            }
            if (infos.countryID == 239) // Venezuela
            {
                url += `&${  googleFormHelper.customField[0].entry  }=${  googleFormHelper.customField[0].force}`;
            }
            window.open(url, '_blank');
        } else { // forum request

            // check per country settings
            var pcs = WMETB_FPgetPerCountrySettings(infos.countryID);
            if (pcs !== null && pcs.hasOwnProperty('MUR')) {
                pcs = pcs.MUR;
                oldForumSettings = false;
                // check per state settings
                if (pcs.hasOwnProperty('all'))
                    pcs = pcs.all;
                else
                    if (pcs.hasOwnProperty(`${  infos.stateID}`))
                        pcs = pcs[`${  infos.stateID}`];
                    else
                        pcs = null;
                if (pcs === null)
                    oldForumSettings = true;
                else {
                    var values = {};
                    values.UserRank = W.loginManager.user.rank + 1;
                    values.UserName = W.loginManager.user.userName;
                    values.CurrentLockRank = `${  infos.maxLock + 1  }${infos.isAutoLock ? '(auto)' : ''}`;
                    values.CountryName = (infos.country === '' ? null : infos.country);
                    values.StateName = (infos.state === '' ? null : infos.state);
                    values.CityName = (infos.city === '' ? null : infos.city);
                    values.StreetName = (infos.streetNames.length > 0 ? infos.streetNames.join(',') : null);
                    values.MainStreetName = (infos.mainStreetName != '' ? infos.mainStreetName : null);
                    values.Permalink = infos.permalink;
                    values.NoLayerPermalink = infos.noLayerPermalink;

                    // WMETB_FPlog("matching title: " + pcs.Title);
                    subject = pcs.Title.replace(/{([^}]*)}/g, function (c) {
                            return WMETB_FPpercountrysettings_replacefunc(c, values);
                        });
                    message = pcs.Message.replace(/{([^}]*)}/g, function (c) {
                            return WMETB_FPpercountrysettings_replacefunc(c, values);
                        });
                    message = message.replace(/\\n/g, '\n');
                    log(`New subject: ${  subject}`);
                    log(`New message: ${  message}`);

                    var url = `https://www.waze.com/forum/posting.php?mode=${  pcs['Topic ID'] == '' ? 'post' : 'reply&t=' + pcs['Topic ID']  }&f=${  pcs['Forum ID']}`;

                    WMETB_FPopenPostDataInNewTab(`${url  }#preview`, {
                        subject: subject,
                        message: message,
                        addbbcode20: '100',
                        preview: 'Preview',
                        attach_sig: 'on',
                        notify: 'on'
                    });

                }
            }
        }
        if (oldForumSettings) {
            var forumSection = WMETB_FPmapupdateForumSection[infos.countryID];
            var forumSectionUR = WMETB_FPunlockForumSection[infos.countryID];
            if (infos.cityID != 0) {
                if (WMETB_FPmapupdateForumSection.hasOwnProperty(infos.countryID) == false) {
                    alert(`Your country is not registered for map updates in WME Toolbox Fancy Permalinks.\nPlease post the number ${  infos.countryID  }, the name of your country (${  infos.country  }) and a link to the map update forum of your country to the Toolbox thread.\nThanks in advance.`);
                    return;
                }
            } else
                log('Map update - Country got from waze model.');
            if (forumSection != forumSectionUR)
                subject = subject.replace(' Update', '');
            WMETB_FPopenPostDataInNewTab(`${forumSection  }#preview`, {
                subject: subject,
                message: message,
                addbbcode20: '100',
                preview: 'Preview',
                attach_sig: 'on',
                notify: 'on'
            });
        }

        return true;
    }

    function WMETB_FPclosure() {
        if (W.selectionManager.getSelectedFeatures().length == 0) {
            alert('Select one or more (Ctrl + click) segments');
            return;
        }
        if (W.selectionManager.getSelectedFeatures()[0].model.type != 'segment') {
            alert('Closure request only segments');
            return;
        }

        var infos = WMETB_FPcollectInfosFromSelection();
        // set subject line
        var subject = `Closure ${ 
            WMETB_FPinclcountry[infos.countryID] === 1 ? (infos.country === '' || infos.state === infos.country ? '' : infos.country + ': ') : '' 
            }${infos.state === '' ? '' : infos.state + ' - ' 
            }${infos.city === '' ? '' : infos.city  } ${ 
            infos.streetNames.length == 0 ? '' : '(' + infos.streetNames.join(',') + ')'}`;

        // WMETB_FPoriginalLink=WMETB_FPdivPerma.firstElementChild;
        // var newLink=WMETB_FPaPerma.href.replace(/#/g, "");
        // var linkWithLayers = newLink;

        // if (WMETB_FPnoLayerMode)
        // {
        //    newLink=newLink.replace(/layers=[0-9]*/g, '');
        //    newLink=newLink.replace(/&&/g, '&');
        // }

        var message = `[url=${  infos.noLayerPermalink  }]Permalink[/url]`;
        var oldForumSettings = true;
        if (typeof(WMETB_FPclosure_gform[infos.countryID]) != 'undefined') {
            // google form country
            oldForumSettings = false;
            var googleFormHelper = WMETB_FPclosure_gform[infos.countryID];
            var url = googleFormHelper.url;

            if (googleFormHelper.hasOwnProperty('usrName') == true)
                url += `&${  googleFormHelper.usrName.entry  }=${  W.loginManager.user.userName}`;

            if (googleFormHelper.hasOwnProperty('message') == true)
                url += `&${  googleFormHelper.message.entry  }=${  encodeURI(infos.streetNames.join(','))}`;

            var newLink = infos.noLayerPermalink;
            newLink = newLink.replace(/&/g, '%26');
            newLink = newLink.replace(/\?/g, '%3F');
            newLink = newLink.replace(/=/g, '%3D');
            url += `&${  googleFormHelper.permalink.entry  }=${  newLink}`;

            if (googleFormHelper.hasOwnProperty('segIdList') == true) {
                // extract seg ids
                segIds = [];
                for (var i = 0; i < W.selectionManager.getSelectedFeatures().length; i++) {
                    segIds.push(`${  W.selectionManager.getSelectedFeatures()[i].model.attributes.id}`);
                }
                url += `&${  googleFormHelper.segIdList.entry  }=${  segIds.join(',')}`;
            }

            if (infos.countryID == 81 || infos.countryID == 14 || infos.countryID == 216) // Germany, Austria, Switzerland
            {
                url += `&${  googleFormHelper.customField[0].entry  }=${  googleFormHelper.customField[0][infos.countryID]}`; // add country
            }
            if (infos.city != '') {
                if (googleFormHelper.hasOwnProperty('cityName') == true)
                    url += `&${  googleFormHelper.cityName.entry  }=${  encodeURI(infos.city)}`;
            }
            window.open(url, '_blank');
        } else {
            // check per country settings
            var pcs = WMETB_FPgetPerCountrySettings(infos.countryID);
            if (pcs !== null && pcs.hasOwnProperty('CR')) {
                pcs = pcs.CR;
                oldForumSettings = false;
                // check per state settings
                if (pcs.hasOwnProperty('all'))
                    pcs = pcs.all;
                else
                    if (pcs.hasOwnProperty(`${  infos.stateID}`))
                        pcs = pcs[`${  infos.stateID}`];
                    else
                        pcs = null;
                if (pcs === null)
                    oldForumSettings = true;
                else {
                    var values = {};
                    values.UserRank = W.loginManager.user.rank + 1;
                    values.UserName = W.loginManager.user.userName;
                    values.CurrentLockRank = `${  infos.maxLock + 1  }${infos.isAutoLock ? '(auto)' : ''}`;
                    values.CountryName = (infos.country === '' ? null : infos.country);
                    values.StateName = (infos.state === '' ? null : infos.state);
                    values.CityName = (infos.city === '' ? null : infos.city);
                    values.StreetName = (infos.streetNames.length > 0 ? infos.streetNames.join(',') : null);
                    values.MainStreetName = (infos.mainStreetName != '' ? infos.mainStreetName : null);
                    values.Permalink = infos.permalink;
                    values.NoLayerPermalink = infos.noLayerPermalink;

                    // WMETB_FPlog("matching title: " + pcs.Title);
                    subject = pcs.Title.replace(/{([^}]*)}/g, function (c) {
                            return WMETB_FPpercountrysettings_replacefunc(c, values);
                        });
                    message = pcs.Message.replace(/{([^}]*)}/g, function (c) {
                            return WMETB_FPpercountrysettings_replacefunc(c, values);
                        });
                    message = message.replace(/\\n/g, '\n');
                    log(`New subject: ${  subject}`);
                    log(`New message: ${  message}`);

                    var url = `https://www.waze.com/forum/posting.php?mode=${  pcs['Topic ID'] == '' ? 'post' : 'reply&t=' + pcs['Topic ID']  }&f=${  pcs['Forum ID']}`;

                    WMETB_FPopenPostDataInNewTab(`${url  }#preview`, {
                        subject: subject,
                        message: message,
                        addbbcode20: '100',
                        preview: 'Preview',
                        attach_sig: 'on',
                        notify: 'on'
                    });

                }
            }
        }
        if (oldForumSettings) {
            var forumSection = WMETB_FPclosureForumSection[infos.countryID];
            if (infos.cityID != 0) {
                if (WMETB_FPclosureForumSection.hasOwnProperty(infos.countryID) == false) {
                    alert(`Your country is not registered for closures in WME Toolbox Fancy Permalinks.\nPlease post the number ${  infos.countryID  }, the name of your country (${  infos.country  }) and a link to the closure forum of your country to the Toolbox thread.\nThanks in advance.`);
                    return;
                }
            } else {
                log('Closure request - Country from Waze model.');
            }
            WMETB_FPopenPostDataInNewTab(`${forumSection  }#preview`, {
                subject: subject,
                message: message,
                addbbcode20: '100',
                preview: 'Preview',
                attach_sig: 'on',
                notify: 'on'
            });

        }

        return true;
    }

    function WMETB_FPunlock() {
        if (W.selectionManager.getSelectedFeatures().length == 0) {
            alert('Select one or more (Ctrl + click) segments or one node or one place');
            return;
        }
        if (W.selectionManager.getSelectedFeatures()[0].model.type != 'segment'
             && W.selectionManager.getSelectedFeatures()[0].model.type != 'venue'
             && W.selectionManager.getSelectedFeatures()[0].model.type != 'node') {
            alert('Unlock request only segments, node, or place');
            return;
        }

        var infos = WMETB_FPcollectInfosFromSelection();
        // set subject line
        var subject = `Level${  infos.maxLock + 1  }→L${  W.loginManager.user.rank + 1 
            } Unlock: ${  WMETB_FPinclcountry[infos.countryID] === 1 ? (infos.country === '' || infos.state === infos.country ? '' : infos.country + ': ') : '' 
            }${infos.state === '' ? '' : infos.state + ' - ' 
            }${infos.city === '' ? '' : infos.city  } ${ 
            infos.streetNames.length == 0 ? '' : '(' + infos.streetNames.join(',') + ')'}`;

        // Special format of the subject line for Indonesia
        if (infos.countryID == 102)
            subject = `Unlock L${  infos.maxLock + 1  }-${  W.loginManager.user.rank + 1 
                }, ${  WMETB_FPinclcountry[infos.countryID] === 1 ? (infos.country === '' || infos.state === infos.country ? '' : infos.country + ': ') : '' 
                }${infos.state === '' ? '' : infos.state + ' - ' 
                }${infos.city === '' ? '' : infos.city  } ${ 
                infos.streetNames.length == 0 ? '' : '(' + infos.streetNames.join(',') + ')'}`;
                
        // Special format of the subject line for Czech Republic
        if (infos.countryID == 57)
            subject = `[L${  infos.maxLock + 1  }]→L${  W.loginManager.user.rank + 1 
                } Unlock: ${  WMETB_FPinclcountry[infos.countryID] === 1 ? (infos.country === '' || infos.state === infos.country ? '' : infos.country + ': ') : '' 
                }${infos.state === '' ? '' : infos.state + ' - ' 
                }${infos.city === '' ? '' : infos.city  } ${ 
                infos.streetNames.length == 0 ? '' : '(' + infos.streetNames.join(',') + ')'}`;

        // include level, location in subject
        // include your level (i.e. "My Level: 2")
        // Short explanation
        // Permalink
        var message = `My Level: ${  W.loginManager.user.rank + 1  }\n` + `Reason for request: ` + `\n\n` + `[url=${  infos.noLayerPermalink  }]Permalink[/url]`;

        // var countryID = 73;
        // if (W.model.countries.additionalInfo.length>0)
        // countryID=W.model.countries.additionalInfo[0].id;
        var oldForumSettings = true;
        if (typeof(WMETB_FPunlock_gform[infos.countryID]) != 'undefined') {
            // google form country
            oldForumSettings = false;
            var googleFormHelper = WMETB_FPunlock_gform[infos.countryID];
            var url = googleFormHelper.url;

            if (googleFormHelper.hasOwnProperty('usrName') == true)
                url += `&${  googleFormHelper.usrName.entry  }=${  W.loginManager.user.userName}`;

            if (googleFormHelper.hasOwnProperty('usrRank') == true)
                url += `&${  googleFormHelper.usrRank.entry  }=${  googleFormHelper.usrRank['' + W.loginManager.user.rank]}`;

            // if (countryID==107) // Italy
            //	names += '\nPlease, check the region below!';

            if (googleFormHelper.hasOwnProperty('message') == true)
                url += `&${  googleFormHelper.message.entry  }=${  encodeURI(infos.streetNames.join(','))}`;

            var newLink = infos.noLayerPermalink;
            newLink = newLink.replace(/&/g, '%26');
            newLink = newLink.replace(/\?/g, '%3F');
            newLink = newLink.replace(/=/g, '%3D');
            url += `&${  googleFormHelper.permalink.entry  }=${  newLink}`;

            if (googleFormHelper.hasOwnProperty('updateRequest') == true)
                url += `&${  googleFormHelper.updateRequest.entry  }=${  googleFormHelper.updateRequest.no}`;

            if (googleFormHelper.hasOwnProperty('requestRank') == true)
                url += `&${  googleFormHelper.requestRank.entry  }=${  googleFormHelper.requestRank['' + infos.maxLock]}`;

            if (infos.countryID == 107) // Italy custom fields
            {
                var lonlat = W.map.getCenter();
                lonlat = OpenLayers.Layer.SphericalMercator.inverseMercator(lonlat.lon, lonlat.lat);
                var region = WMETB_FP_ITALY_getRegion(lonlat.lon, lonlat.lat);
                if (region != null) {
                    url += `&${  googleFormHelper.customField[0].entry  }=${  region}`;
                }
            }
            if (infos.city != '') {
                if (googleFormHelper.hasOwnProperty('cityName') == true)
                    url += `&${  googleFormHelper.cityName.entry  }=${  encodeURI(infos.city)}`;
            }

            if (infos.countryID == 220 || infos.countryID == 28 || infos.countryID == 250 || infos.countryID == 155 || infos.countryID == 164) // Tanzania Botswana Zimbabwe Namibia Nigeria
            {
                url += `&${  googleFormHelper.customField[0].entry  }=${  googleFormHelper.customField[0][infos.countryID]}`; // add country
            }
            if (infos.countryID == 239) // Venezuela
            {
                url += `&${  googleFormHelper.customField[0].entry  }=${  googleFormHelper.customField[0].force}`;
            }

            window.open(url, '_blank');
        } else {
            // check per country settings
            var pcs = WMETB_FPgetPerCountrySettings(infos.countryID);
            if (pcs !== null && pcs.hasOwnProperty('UnlockR')) {
                pcs = pcs.UnlockR;
                oldForumSettings = false;
                // check per state settings
                if (pcs.hasOwnProperty('all'))
                    pcs = pcs.all;
                else
                    if (pcs.hasOwnProperty(`${  infos.stateID}`))
                        pcs = pcs[`${  infos.stateID}`];
                    else
                        pcs = null;
                if (pcs === null)
                    oldForumSettings = true;
                else {
                    var values = {};
                    values.UserRank = W.loginManager.user.rank + 1;
                    values.UserName = W.loginManager.user.userName;
                    values.CurrentLockRank = `${  infos.maxLock + 1  }${infos.isAutoLock ? '(auto)' : ''}`;
                    values.CountryName = (infos.country === '' ? null : infos.country);
                    values.StateName = (infos.state === '' ? null : infos.state);
                    values.CityName = (infos.city === '' ? null : infos.city);
                    values.StreetName = (infos.streetNames.length > 0 ? infos.streetNames.join(',') : null);
                    values.MainStreetName = (infos.mainStreetName != '' ? infos.mainStreetName : null);
                    values.Permalink = infos.permalink;
                    values.NoLayerPermalink = infos.noLayerPermalink;

                    // WMETB_FPlog("matching title: " + pcs.Title);
                    subject = pcs.Title.replace(/{([^}]*)}/g, function (c) {
                            return WMETB_FPpercountrysettings_replacefunc(c, values);
                        });
                    message = pcs.Message.replace(/{([^}]*)}/g, function (c) {
                            return WMETB_FPpercountrysettings_replacefunc(c, values);
                        });
                    message = message.replace(/\\n/g, '\n');
                    log(`New subject: ${  subject}`);
                    log(`New message: ${  message}`);

                    var url = `https://www.waze.com/forum/posting.php?mode=${  pcs['Topic ID'] == '' ? 'post' : 'reply&t=' + pcs['Topic ID']  }&f=${  pcs['Forum ID']}`;

                    WMETB_FPopenPostDataInNewTab(`${url  }#preview`, {
                        subject: subject,
                        message: message,
                        addbbcode20: '100',
                        preview: 'Preview',
                        attach_sig: 'on',
                        notify: 'on'
                    });

                }
            }
        }
        if (oldForumSettings) {
            var forumSection = WMETB_FPunlockForumSection[infos.countryID];
            var forumSectionMUR = WMETB_FPmapupdateForumSection[infos.countryID];
            if (infos.cityID != 0) {
                if (WMETB_FPunlockForumSection.hasOwnProperty(infos.countryID) == false) {
                    alert(`Your country is not registered in WME Fancy Permalink.\nPlease, send me this number: ${  infos.countryID  } and a link to the unlock forum of your country to the Toolbox thread.\nThank you in advance.`);
                    return;
                }
            } else {
                log('Unlock request - Country from Waze model.');
            }
            if (forumSectionMUR != forumSection)
                subject = subject.replace(' Unlock', '');
            WMETB_FPopenPostDataInNewTab(`${forumSection  }#preview`, {
                subject: subject,
                message: message,
                addbbcode20: '100',
                preview: 'Preview',
                attach_sig: 'on',
                notify: 'on'
            });
        }

        return true;
    }

    function WMETB_FPjoinOnKey(tab, sep) {
        var keys = '';
        for (var k in tab) {
            if (tab.hasOwnProperty(k)) {
                keys += k + sep;
            }
        }
        keys = keys.substring(0, keys.length - sep.length);
        return keys;
    }

    function WMETB_FPpmToUserID(userIDs, subject, message, countryID) {
        var userNames = [];

        for (var i = 0; i < userIDs.length; i++) {
            // log ("PM TO: " + userIDs[i]);
            if (userIDs[i] == -1)
                continue;
            var user = W.model.users.objects[userIDs[i]];
            if (typeof(user) === 'undefined' || user == null) {
                // log ("Error: can't find user " + userIDs[i]);
                continue;
            }
            userNames.push(W.model.users.objects[userIDs[i]].userName);
        }
        WMETB_FPpmToUserName(userNames, subject, message, countryID);
    }

    function WMETB_FPpmToUserName(userNames, subject, message, countryID) {
        var uniqueUserNames = userNames.filter(function (elem, pos, self) {
                return self.indexOf(elem) == pos;
            });

        if (uniqueUserNames.length != 0) {
            // var forumIds = WMETB_FPgetForumUserIdFromNames(uniqueUserNames);
            // var forumIdsUnknown = forumIds.filter(function (elem) {
            //         return elem.id == -1;
            //     });
            // var forumIdsMultiple = forumIds.filter(function (elem) {
            //         return elem.id == -2;
            //     });
            // var forumIdsClean = forumIds.filter(function (elem) {
            //         return (elem.id != -1 && elem.id != -2);
            //     });

            // var info = '';

            // if (forumIdsUnknown.length != 0)
            //     info += forumIdsUnknown.map(function (elem) {
            //         return elem.name;
            //     }).join(",") + ' ' + (forumIdsUnknown.length == 1 ? 'is' : 'are') + ' unknown in the forum (probably never logged in)\n';
            // if (forumIdsMultiple.length != 0)
            //     info += 'Multiple match for ' + (forumIdsMultiple.length == 1 ? 'this user' : 'those users') + '; ' + forumIdsUnknown.map(function (elem) {
            //         return elem.name;
            //     }).join(",") + '. You should add them manually';
            // if (info != '')
            //     alert(info);
            // if (uniqueUserNames.length > 5) {
            //     alert('There are more than 5 recipients.\nIt is a limitation of the Waze forum.\nOnly the 5 first AMs will be added to the recipient list.');
            // }

            // var userList=uniqueUserNames.join(';');
            var inputs = {};
            // for (var u = 0; u < forumIdsClean.length && u < 5; u++) {
            //     inputs['address_list[u][' + forumIdsClean[u].id + ']'] = 'to';
            // }
            inputs.username_list = uniqueUserNames[0];
            inputs.subject = subject;
            inputs.message = message;
            inputs.attach_sig = 'on';
            inputs.preview = 'Preview';
            // WMETB_FPlog("inputs:", inputs);
            // GM_openInTab('https://www.waze.com/forum/ucp.php?i=pm&mode=compose&username_list=' + userList + '&subject=' + subject + '&message=' + message);
            // if(W.location.code=="il") {
            // WMETB_FPopenPostDataInNewTab('https://www.waze.com/he/forum/ucp.php?i=pm&mode=compose', inputs);
            // } else {
            WMETB_FPopenPostDataInNewTab('https://www.waze.com/forum/ucp.php?i=pm&mode=compose', inputs);
            // }
        } else {
            log('Error: no user to write to...');
        }
    }

    function WMETB_FPgetURComments(domComments) {
        var comments = [];
        for (var i = 0; i < domComments.children.length; i++) {
            var comment = domComments.children[i];
            var authorEl = document.getElementsByClassName('username', comment);
            if (authorEl == null)
                return null;
            var textEl = document.getElementsByClassName('text', comment);
            if (textEl == null)
                return null;
            var text = textEl[0].innerHTML;
            text = text.replace(/<br>/g, '\n');
            text = text.replace(/\n    /g, '');
            text = text.trim();
            comments.push({
                author: authorEl[0].textContent.replace(/\([1-7]\)$/g, ''),
                comment: text
            });

        }
        // console.debug("commentaires: ", comments);
        return comments;
    }

    function WMETB_FPcopyToClipboard(text) {
        GM_setClipboard(text);
        // log(text);
    }

    function WMETB_FPgetAMArea(bounds) {
        var AMAreas = null;
        var lonMin = Math.min(bounds.left, bounds.right);
        var latMin = Math.min(bounds.top, bounds.bottom);
        var lonMax = Math.max(bounds.left, bounds.right);
        var latMax = Math.max(bounds.top, bounds.bottom);

        if (lonMax - lonMin < 0.001) {
            lonMin -= 0.0005;
            lonMax += 0.0005;
        }
        if (latMax - latMin < 0.001) {
            latMin -= 0.0005;
            latMax += 0.0005;
        }

        var xhr3_object = new XMLHttpRequest();
        xhr3_object.addEventListener('readystatechange', function () {
            if (xhr3_object.readyState == 4) {
                var r = xhr3_object.responseText;
                AMAreas = jQuery.parseJSON(r);
            }
        }, false);
        // log('Get AMs URL: ' + 'https://www.waze.com/row-Descartes-live/app/Features?language=fr&managedAreas=true&bbox=' + lonMin + ',' + latMin + ',' + lonMax + ',' + latMax);
        // xhr3_object.open("GET", 'https://www.waze.com/row-Descartes-live/app/Features?language=fr&managedAreas=true&bbox=' + lonMin + ',' + latMin + ',' + lonMax + ',' + latMax, false);
        // fixed: AM list for non row server:
        xhr3_object.open('GET', `https://${  document.location.host  }${W.Config.api_base  }/Features?managedAreas=true&bbox=${  lonMin  },${  latMin  },${  lonMax  },${  latMax}`, false);
        xhr3_object.send(null);

        for (var i = 0; i < AMAreas.managedAreas.objects.length; i++) {
            var area = AMAreas.managedAreas.objects[i];
            for (var j = 0; j < AMAreas.users.objects.length; j++)
                if (AMAreas.users.objects[j].id == area.userID) {
                    area.userName = AMAreas.users.objects[j].userName;
                    area.userRank = AMAreas.users.objects[j].rank;
                }
        }
        // log("AMs:", AMAreas);
        return AMAreas;
    }

    function WMETB_FPnewSelectionAvailable() {
        if (W.selectionManager.getSelectedFeatures().length != 1)
            return;
        var selectedObject = W.selectionManager.getSelectedFeatures()[0];
        if (selectedObject.model.type !== 'segment' && selectedObject.model.type !== 'venue' && selectedObject.model.type !== 'mapComment')
            return;

        var editPanel = getElementById('edit-panel');
        if (editPanel.firstElementChild.style.display == 'none')
            window.setTimeout(WMETB_FPnewSelectionAvailable, 100);

        // ok: 1 selected item and panel is shown

        var type = null;
        var lastEditor = null;
        var creator = null;

        var item = null;
        var posInDOM = 1;
        var hasUpdater = true;
        var subject = '';
        var countryID;

        if (selectedObject.model.type == 'segment') {
            item = document.getElementsByClassName('additional-attributes list-unstyled', getElementById('segment-edit-general'));
            if (item[0].children.length == 3) { // only the creator
                posInDOM = 0;
                hasUpdater = false;
                type = 'seg';
            }
        } else if (selectedObject.model.type == 'venue') {
            if (selectedObject.model.attributes.name != null && selectedObject.model.attributes.name != '')
                subject += selectedObject.model.attributes.name;
            item = document.getElementsByClassName('additional-attributes list-unstyled', getElementById('landmark-edit-general'));
            posInDOM = 0;
            if (item[0].children.length == 2) { // only the creator
                posInDOM = -1;
                hasUpdater = false;
            }
        } else { // selectedObject.model.type=="mapComment"
            if (selectedObject.model.attributes.subject != null && selectedObject.model.attributes.subject != '')
                subject += `Map comment '${  selectedObject.model.attributes.subject  }'`;
            item = document.getElementsByClassName('additional-attributes list-unstyled', getElementById('map-comment-feature-editor'));
            posInDOM = 0;
            if (item[0].children.length == 2) { // only the creator
                posInDOM = -1;
                hasUpdater = false;
            }
        }

        if (typeof(selectedObject.model.attributes.primaryStreetID) !== 'undefined' ||
            typeof(selectedObject.model.attributes.streetID) !== 'undefined') {
            var street = null;
            if (typeof(selectedObject.model.attributes.primaryStreetID) !== 'undefined' && selectedObject.model.attributes.primaryStreetID != null) {
                street = W.model.streets.objects[selectedObject.model.attributes.primaryStreetID];
                //        else
                //            street=W.model.streets.objects[selectedObject.attributes.streetID];
                // log("Street: ", street);
                if (street.name != null && street.name != '') {
                    if (subject != '')
                        subject += ', ';
                    subject += street.name;
                }
                if (street.cityID != null && W.model.cities.objects[street.cityID] != null && W.model.cities.objects[street.cityID].name != '') {
                    if (subject != '')
                        subject += ', ';
                    subject += W.model.cities.objects[street.cityID].attributes.name;
                    wmeCity = W.model.cities.getObjectById(street.cityID);
                    countryID = wmeCity.countryID;
                }
            }
        }

        if (subject == '')
            subject = `About this ${  selectedObject.model.type}`;

        if (countryID == null) {
            countryID = W.model.getTopCountry().id
        }

        if(item.length > 0) {
            // WMETB_FPoriginalLink=WMETB_FPdivPerma.firstElementChild;
            var newLink = WMETB_FPaPerma.href.replace(/#/g, '');
            var message = `[url=${  newLink  }]Permalink[/url]\n`;
            // message=encodeURIComponent(message);

            lastEditor = selectedObject.model.attributes.updatedBy;
            creator = selectedObject.model.attributes.createdBy;

            // Create icon and link for object creator
            // Added the timeout after Waze added the tile build status indicator becuase
            // there was enough of a dely as the tile status info loads that it
            // prevented the icons from attaching
            setTimeout(function() {
                if (creator != null && creator != -1) {
                    let hasUpdater = lastEditor != null ? 1 : 0;
                    var link = document.createElement('a');
                    link.innerHTML = WMETB_FPsmallredPM;
                    link.href = '#';
                    link.id = 'WMEFP-SEG-PM-C';
                    link.style.marginLeft = '5px';
                    link.addEventListener('click', WMETB_FPgetFunctionWithArgs(WMETB_FPpmToUserID, [[creator], subject, message, countryID]), false);
                    if(type === 'seg') {
                        item[0].children[1].children[0].children[hasUpdater].appendChild(link);
                    } else {
                        item[0].children[hasUpdater].appendChild(link);
                    }
                }

                // Create icon and link for object last updated by
                if (lastEditor != null && lastEditor != -1) {
                    var link = document.createElement('a');
                    link.innerHTML = WMETB_FPsmallredPM;
                    link.href = '#';
                    link.id = 'WMEFP-SEG-PM-E';
                    link.style.marginLeft = '5px';
                    link.addEventListener('click', WMETB_FPgetFunctionWithArgs(WMETB_FPpmToUserID, [[lastEditor], subject, message, countryID]), false);
                    if(type === 'seg') {
                        item[0].children[1].children[0].children[0].appendChild(link);
                    } else {
                        item[0].children[0].appendChild(link);
                    }
                }
            }, 200)

            // AMs

            /* bounds = selectedObject.geometry.bounds;
            if (bounds.left == bounds.right) {
                bounds.left -= 100;
                bounds.right += 100;
            }
            if (bounds.top == bounds.bottom) {
                bounds.bottom -= 100;
                bounds.top += 100;
            }
            var lonlatMin = OpenLayers.Layer.SphericalMercator.inverseMercator(bounds.left, bounds.bottom);
            var lonlatMax = OpenLayers.Layer.SphericalMercator.inverseMercator(bounds.right, bounds.top);
            var lonlatBounds = {
                left: lonlatMin.lon,
                right: lonlatMax.lon,
                bottom: lonlatMin.lat,
                top: lonlatMax.lat
            };

            var AMli = document.createElement('li');
            AMli.id = "WMEFP-AMList";
            //AMli.innerHTML="<b>Area Managers</b>: ";
            var getAMList = document.createElement('a');
            getAMList.href = '#';
            getAMList.innerHTML = 'Get the list of Area Managers';
            getAMList.addEventListener("click", WMETB_FPgetFunctionWithArgs(WMETB_FPfillAMList, [lonlatBounds, subject, message]), false);
            AMli.appendChild(getAMList);

            item[0].appendChild(AMli); */
        }
    }

    function WMETB_FPfillAMList(bounds, subject, message) {
        var AMs = WMETB_FPgetAMArea(bounds);
        var AMli = getElementById('WMEFP-AMList');
        AMli.innerHTML = '';
        var ulList = document.createElement('ul');
        ulList.className = 'list-unstyled';

        var selectedObject = W.selectionManager.getSelectedFeatures()[0];
        var AMNames = [];
        for (var am = 0; am < AMs.managedAreas.objects.length; am++) {
            var theAM = AMs.managedAreas.objects[am];

            var olPolygons = WMETB_FPwazeMapAreaToOLPolygons(theAM.geometry);
            var inside = false;
            for (var p = 0; p < olPolygons.length; p++) {
                if (selectedObject.model.type == 'segment') {
                    // log('Filter AM: point: ', selectedObject.geometry.components[0]);
                    // log('Filter AM: in: ', olPolygons[p]);

                    if (olPolygons[p].containsPoint(selectedObject.geometry.components[0])) {
                        inside = true;
                        break;
                    }
                    if (olPolygons[p].containsPoint(selectedObject.geometry.components[selectedObject.geometry.components.length - 1])) {
                        inside = true;
                        break;
                    }
                }
                if (selectedObject.model.type == 'venue') {
                    if (typeof(selectedObject.geometry.components) === 'undefined') { // POINT
                        if (olPolygons[p].containsPoint(selectedObject.geometry)) {
                            inside = true;
                            break;
                        }
                    } else { // landmark polygon
                        if (olPolygons[p].intersects(selectedObject.geometry.components[0])) {
                            inside = true;
                            break;
                        }
                    }
                }
            }
            if (!inside)
                continue;
            var theAMli = document.createElement('li');
            theAMli.innerHTML = `${theAM.userName  }(${  theAM.userRank + 1  })`;

            var link = document.createElement('a');
            link.innerHTML = WMETB_FPsmallredPM;
            link.href = '#';
            link.id = `WMEFP-PM-AM-${  theAM.id}`;
            link.addEventListener('click', WMETB_FPgetFunctionWithArgs(WMETB_FPpmToUserName, [[theAM.userName], subject, message]), false);
            theAMli.appendChild(link);

            ulList.appendChild(theAMli);
            AMNames.push(theAM.userName);
        }

        var linkToAllAMs = document.createElement('a');
        linkToAllAMs.innerHTML = WMETB_FPredpermalinkmulti;
        linkToAllAMs.href = '#';
        linkToAllAMs.id = 'WMEFP-PM-ALL-AM';
        linkToAllAMs.addEventListener('click', WMETB_FPgetFunctionWithArgs(WMETB_FPpmToUserName, [AMNames, subject, message]), false);
        AMli.appendChild(linkToAllAMs);

        var title = document.createElement('span');
        title.style.fontWeight = 'bold';
        title.innerHTML = 'Area Managers:';
        AMli.appendChild(title);
        AMli.appendChild(ulList);
    }

    function WMETB_FPgetSelectedProblemOrUR () {
        try {
            for (var m in W.map.problemLayer.markers) {
                if (W.map.problemLayer.markers.hasOwnProperty(m)) {
                    if (W.map.problemLayer.markers[m].icon.imageDiv.className.indexOf('selected') != -1)
                        return {
                            id: m,
                            type: 'P'
                        };
                }
            }
        } catch (e) {
            log('error while getting selected problem: ', e);
        }
        try {
            for (var m in W.map.updateRequestLayer.markers) {
                if (W.map.updateRequestLayer.markers.hasOwnProperty(m)) {
                    if (W.map.updateRequestLayer.markers[m].icon.imageDiv.className.indexOf('selected') != -1)
                        return {
                            id: m,
                            type: 'UR'
                        };
                }
            }
        } catch (e) {
            log('error while getting selected UR: ', e);
        }
        return null;
    }

    function WMETB_FPupdate() {
        // WMETB_FPoriginalLink=WMETB_FPdivPerma.firstElementChild;
        var newLink = WMETB_FPaPerma.href.replace(/#/g, '');
        var newbblLink = `[url=${  newLink  }][/url]`;

        var panelEl = getElementById('panel-container');
        if (panelEl != null) {
            var subject = 'About this Problem...';
            var MPorUR = WMETB_FPgetSelectedProblemOrUR();
            if (MPorUR != null && MPorUR.type == 'UR')
                subject = 'About this UR...';
            else if (MPorUR != null && MPorUR.type == 'P')
                subject = 'About this MP...';
            var message = '';
            message += `[url=${  newLink  }]Permalink[/url]\n\n`;

            var comments = document.getElementsByClassName('comment-list list-unstyled', panelEl);
            var userNames = [];

            // add PM links to conversation

            if (typeof comments !== 'undefined' && comments.length == 1) {
                var commentsText = WMETB_FPgetURComments(comments[0]);

                if (commentsText != null) {
                    for (var i = 0; i < commentsText.length; i++) {
                        message += `[quote="${  commentsText[i].author  }"]\n${  commentsText[i].comment  }[/quote]\n`;
                    }
                }
                // message=encodeURIComponent(message);

                for (var i = 0; i < comments[0].children.length; i++) {
                    var authorEl = document.getElementsByClassName('username', comments[0].children[i]);
                    // console.debug("author el", authorEl);
                    if (authorEl == null)
                        continue;
                    var userName = commentsText[i].author;
                    if (userName == 'Reporter')
                        continue;
                    userNames.push(userName);
                    if (authorEl[0].parentNode.children.length == 2) {
                        // getting name:


                        var link = document.createElement('a');
                        link.innerHTML = `${WMETB_FPsmallredPM  }&nbsp`;
                        link.href = '#';
                        link.id = `WMEFP-UR-PM-FORM-${  i}`;
                        link.addEventListener('click', WMETB_FPgetFunctionWithArgs(WMETB_FPpmToUserName, [[userName], subject, message]), false);
                        authorEl[0].parentNode.insertBefore(link, authorEl[0]);

                    }
                }

                if (commentsText != null && commentsText.length != 0) {
                    var conversationSectionEl = document.getElementsByClassName('conversation section', panelEl);
                    if (conversationSectionEl[0].className.indexOf('collapsed') != -1 && conversationSectionEl[0].firstElementChild.id == 'WMEFP-UR-ALLPM')
                        conversationSectionEl[0].removeChild(conversationSectionEl[0].firstElementChild);

                    if (conversationSectionEl[0].className.indexOf('collapsed') == -1 && conversationSectionEl[0].firstElementChild.id != 'WMEFP-UR-ALLPM') {
                        var nodeAllPM = document.createElement('div');
                        nodeAllPM.id = 'WMEFP-UR-ALLPM';
                        nodeAllPM.style.display = 'block';
                        nodeAllPM.style.position = 'relative';
                        nodeAllPM.style.right = '40px';
                        nodeAllPM.style.marginLeft = '-40px';
                        nodeAllPM.style.top = '10px';
                        nodeAllPM.style.cssFloat = 'right';
                        nodeAllPM.style.zIndex = '9999';
                        // log(joinOnKey(userNames, '/'));

                        var link = document.createElement('a');
                        link.innerHTML = WMETB_FPredpermalinkmulti;
                        link.href = '#';
                        link.addEventListener('click', WMETB_FPgetFunctionWithArgs(WMETB_FPpmToUserName, [userNames, subject, message]), false);

                        nodeAllPM.appendChild(link);

                        conversationSectionEl[0].insertBefore(nodeAllPM, conversationSectionEl[0].firstElementChild);
                    }
                }
            }
            // add PM link to closer
            var closedByEl = document.getElementsByClassName('close-details section', panelEl);
            if (typeof closedByEl !== 'undefined' && closedByEl != null && closedByEl.length == 1) {
                var closerEl = document.getElementsByClassName('by', closedByEl[0]);
                if (typeof closerEl !== 'undefined' && closerEl != null && closerEl.length == 1) {
                    if (getElementById('WMEFP-UR-PM-FORM-CLOSER') == null) {
                        var userName = closerEl[0].textContent.replace(/\([1-7]\)$/g, '');
                        userName = userName.split(' ');
                        userName = userName[userName.length - 1];
                        userName = userName.trim();

                        var link = document.createElement('a');
                        link.innerHTML = `&nbsp${  WMETB_FPsmallredPM}`;
                        link.href = '#';
                        link.id = 'WMEFP-UR-PM-FORM-CLOSER';
                        link.addEventListener('click', WMETB_FPgetFunctionWithArgs(WMETB_FPpmToUserName, [[userName], subject, message]), false);
                        closerEl[0].appendChild(link);
                        // closerEl[0].parentNode.insertAfter(link, closerEl[0]);
                    }
                }
            }
        }

        panelEl = getElementById('dialog-region');
        if (panelEl != null) {
            //			if (panelEl.children.length > 0)
            //				WMETB_FPlog("panelEl FC", panelEl.firstChild);
            if (panelEl.children.length > 0 && panelEl.firstChild.className.indexOf('edit-closure') != -1) {
                var ulEls = document.getElementsByClassName('list-unstyled', panelEl);
                if (ulEls.length == 1) {
                    var ulEl = ulEls[0];
                    for (var i = 0; i < ulEl.children.length; i++) {
                        if (ulEl.children[i].children.length != 0)
                            continue;
                        // WMETB_FPlog("li", ulEl.children[i]);
                        var temp = ulEl.children[i].innerHTML.trim().split(' ');
                        var userName = temp[temp.length - 1].replace(/\([1-7]\)$/g, '');
                        userName = userName.trim();
                        var link = document.createElement('a');
                        link.innerHTML = `&nbsp${  WMETB_FPsmallredPM}`;
                        link.href = '#';
                        link.id = `WMEFP-CLOSURE-PM-FORM-${  ulEl.children.length == 1 || i == 1 ? 'CREATOR' : 'UPDATER'}`;
                        link.addEventListener('click', WMETB_FPgetFunctionWithArgs(WMETB_FPpmToUserName, [[userName], 'About this closure...', `[url=${  newLink  }]Permalink[/url]\n\n`]), false);
                        ulEl.children[i].appendChild(link);

                    }
                }
            }
        }
        if (WMETB_FPcurLink == WMETB_FPaPerma.href)
            return;
        WMETB_FPcurLink = WMETB_FPaPerma.href;
        WMETB_FPnodeWMEFP.innerHTML = '';

        var elem;

        var lat = null;
        var lon = null;
        var latMatch = newLink.match(/lat=\-?[0-9]+\.?[0-9]+/);
        if (latMatch != null && latMatch.length == 1)
            lat = latMatch[0].substring(4);
        var lonMatch = newLink.match(/lon=\-?[0-9]+\.?[0-9]+/);
        if (lonMatch != null && lonMatch.length == 1)
            lon = lonMatch[0].substring(4);

        if (lat != null && lon != null) {
            var ns = 'N';
            var ew = 'E';
            if (lat < 0) {
                lat *= -1.0;
                ns = 'S';
            }
            if (lon < 0) {
                lon *= -1.0;
                ew = 'W';
            }
            elem = document.createElement('a');
            elem.setAttribute('data', 'lonlat');
            elem.innerHTML = WMETB_FPredLatLonImg;
            elem.href = '#';
            // elem.title='Decimal Lon Lat as positive numbers with E/W and N/S orientations\nClick to copy to clipboard';
            // elem.onclick=WMETB_FPgetFunctionWithArgs(WMETB_FPcopyToClipboard, [ '' + lat + ' ' + ns + ' ' + lon + ' ' + ew]);
            elem.firstChild.addEventListener('mouseover', WMETB_FPgetFunctionWithArgs(WMETB_FPsetupCTC, [`${  lon  } ${  ew  } ${  lat  } ${  ns}`, 'lonlat']), false);
            elem.firstChild.addEventListener('mouseleave', WMETB_FPhideCTCTTT, false);
            WMETB_FPnodeWMEFP.appendChild(elem);
        }

        var ttt = null;

        elem = document.createElement('a');
        elem.setAttribute('data', 'closure');
        elem.innerHTML = WMETB_FPclosurelinkImg;
        elem.href = '#';
        elem.addEventListener('click', WMETB_FPclosure, false);
        elem.firstChild.addEventListener('mouseover', WMETB_FPgetFunctionWithArgs(WMETB_FPshowCTCTTT, ['Click to request a closure on the Waze forum']), false);
        elem.firstChild.addEventListener('mouseleave', WMETB_FPhideCTCTTT, false);
        WMETB_FPnodeWMEFP.appendChild(elem);

        elem = document.createElement('a');
        elem.setAttribute('data', 'unlock');
        elem.innerHTML = WMETB_FPunlocklinkImg;
        elem.href = '#';
        elem.addEventListener('click', WMETB_FPunlock, false);
        elem.firstChild.addEventListener('mouseover', WMETB_FPgetFunctionWithArgs(WMETB_FPshowCTCTTT, ['Click to request an unlock on the Waze forum']), false);
        elem.firstChild.addEventListener('mouseleave', WMETB_FPhideCTCTTT, false);
        WMETB_FPnodeWMEFP.appendChild(elem);

        elem = document.createElement('a');
        elem.setAttribute('data', 'mur');
        elem.innerHTML = WMETB_FPMURlinkImg;
        elem.href = '#';
        elem.addEventListener('click', WMETB_FPmapupdate, false);
        elem.firstChild.addEventListener('mouseover', WMETB_FPgetFunctionWithArgs(WMETB_FPshowCTCTTT, ['Click to request a map update on the Waze forum']), false);
        elem.firstChild.addEventListener('mouseleave', WMETB_FPhideCTCTTT, false);
        WMETB_FPnodeWMEFP.appendChild(elem);

        elem = document.createElement('a');
        elem.setAttribute('data', 'forum');
        elem.innerHTML = WMETB_FPbubblelinkImg;
        elem.href = '#';
        // elem.onclick=WMETB_FPgetFunctionWithArgs(WMETB_FPcopyToClipboard, [ newbblLink ]);
        elem.firstChild.addEventListener('mouseover', WMETB_FPgetFunctionWithArgs(WMETB_FPsetupCTC, [newbblLink, 'forum']), false);
        elem.firstChild.addEventListener('mouseleave', WMETB_FPhideCTCTTT, false);
        WMETB_FPnodeWMEFP.appendChild(elem);

        /*
        elem=document.createElement('a');
        elem.innerHTML=WMETB_FPsquarelinkImg;
        elem.href='#';
        elem.title='Click to copy the permalink to clipboard';
        //elem.onclick=WMETB_FPgetFunctionWithArgs(WMETB_FPcopyToClipboard, [ newLink ]);
        //elem.addEventListener('mouseOver', WMETB_FPsetupCTC, false);
        elem.firstChild.onmouseover=WMETB_FPgetFunctionWithArgs(WMETB_FPsetupCTC, [ newLink ]);
        elem.firstChild.onmouseleave=WMETB_FPhideCTCTTT;
        WMETB_FPnodeWMEFP.appendChild(elem);
         */

        elem = document.createElement('a');
        elem.setAttribute('data', 'pl');
        elem.id = 'WMEFP-GLOBAL-PL';
        elem.innerHTML = WMETB_FPredlinkImg;
        var noLayerNewLink = newLink;
        if (NO_LAYER_MODE) {
            noLayerNewLink = WMETB_FPcutLayers(noLayerNewLink);
        }

        elem.href = noLayerNewLink;
        elem.firstChild.addEventListener('mouseover', WMETB_FPgetFunctionWithArgs(WMETB_FPsetupCTC, [newLink, 'pl']), false);
        elem.firstChild.addEventListener('mouseleave', WMETB_FPhideCTCTTT, false);
        WMETB_FPnodeWMEFP.appendChild(elem);

        elem = document.createElement('textarea');
        // elem.style.visibility='hidden';
        elem.style.cssFloat = 'right';
        elem.style.position = 'absolute';
        elem.style.display = 'inline';
        elem.style.left = '100px';
        elem.style.width = '0px';
        elem.style.height = '0px';
        elem.style.margin = '0px';
        elem.style.padding = '0px';
        elem.style.fontSize = '0pt';
        elem.id = 'wmefp-ctc';
        elem.addEventListener('keydown', WMETB_FPctcKeyDown, false);
        WMETB_FPnodeWMEFP.appendChild(elem);

        elem = document.createElement('div');
        elem.style.cssFloat = 'right';
        elem.style.position = 'absolute';
        elem.style.right = '50px';
        elem.style.top = '-50px';
        elem.style.backgroundColor = '#000000';
        elem.style.color = '#FFFFFF';
        elem.style.borderRadius = '5px';
        elem.style.paddingLeft = '5px';
        elem.style.paddingRight = '5px';
        elem.style.display = 'none';
        elem.innerHTML = `Hit ${  IS_MAC ? String.fromCharCode(0x2318) : 'Ctrl'  }-c to copy to clipboard`;
        elem.id = 'wmefp-ctcttt';
        WMETB_FPnodeWMEFP.appendChild(elem);

        WMETB_FPnodeWMEFP.addEventListener('keydown', WMETB_FPKeyDown, false);
    }

    function WMETB_FPsetupCTC(link, data) { // TODO: function
        // WMETB_FPlog('CTC');
        var myTexts = null;
        var tmpTextObject = WMETB_FPgetPLTexts();
        for (var elems in tmpTextObject) {
            if (elems == data)
                myTexts = tmpTextObject[elems];
        }
        WMETB_FPshowCTCTTT(myTexts.text);
        var ctc = getElementById('wmefp-ctc');
        ctc.style.display = 'inline';
        ctc.value = myTexts.link;
        if (data)
            ctc.setAttribute('data', data);
        ctc.focus();
        ctc.select();
    }

    function WMETB_FPshowCTCTTT(text) {
        // WMETB_FPlog('this', this);
        var ctcttt = getElementById('wmefp-ctcttt');
        ctcttt.innerHTML = text;
        var lineCount = text.split('<br>').length;
        ctcttt.style.top = `-${  lineCount * 25  }px`;
        ctcttt.style.display = 'block';
        if (this != window)
            this.parentNode.focus();
        /* var ctc = WMETB_FPgetId('wmefp-ctc');
        ctc.focus(); */
    }

    function WMETB_FPhideCTCTTT() {
        getElementById('wmefp-ctcttt').style.display = 'none';
        getElementById('wmefp-ctc').style.display = 'none';
    }

    function WMETB_FPctcKeyDown(e) {
        // WMETB_FPlog('key', e);

        if (((e.ctrlKey && !IS_MAC) || (e.metaKey && IS_MAC)) && !e.altGraphKey && !e.altKey && !e.shiftKey && e.keyCode == 67) {
            /* var ctcttt=WMETB_FPgetId('wmefp-ctcttt');
            ctcttt.style.top='-25px';
            ctcttt.innerHTML='Text copied!'; */
            WMETB_FPshowCTCTTT('Text copied!');
        }
    }

    function WMETB_FPKeyDown(e) {
        // WMETB_FPlog('key', e);
        var elemType = e.target.getAttribute('data');
        // WMETB_FPlog('data', elemType);
        if (e.shiftKey && (elemType == 'pl' || elemType == 'forum')) {
            NO_LAYER_MODE = !NO_LAYER_MODE;
            WMETB_FPsetupCTC('', elemType);
            var fppl = getElementById('WMEFP-GLOBAL-PL');
            if (fppl != null)
                fppl.href = myTexts.link;
        }
    }

    function WMETB_FPgetPLTexts() {
        var newLink = WMETB_FPcurePL(WMETB_FPaPerma.href.replace(/#/g, ''));
        var FPConvertBetaPermalinks = JSON.parse(localStorage.getItem('WME_Toolbox_Options'))['ConvertBetaPermalinks'];
        if ((window.location.hostname === 'beta.waze.com') && FPConvertBetaPermalinks) {
            newLink = newLink.replace('beta.waze.com', 'www.waze.com');
        }

        var lat = null;
        var lon = null;
        var latMatch = newLink.match(/lat=\-?[0-9]+\.?[0-9]+/);
        if (latMatch != null && latMatch.length == 1)
            lat = latMatch[0].substring(4);
        var lonMatch = newLink.match(/lon=\-?[0-9]+\.?[0-9]+/);
        if (lonMatch != null && lonMatch.length == 1)
            lon = lonMatch[0].substring(4);
        if (lat != null && lon != null) {
            var ns = 'N';
            var ew = 'E';
            if (lat < 0) {
                lat *= -1.0;
                ns = 'S';
            }
            if (lon < 0) {
                lon *= -1.0;
                ew = 'W';
            }
        }

        if (NO_LAYER_MODE)
            newLink = WMETB_FPcutLayers(newLink);
        var WMETB_FPTextPrefix = (NO_LAYER_MODE ? 'No layer<br>' : '');
        var WMETB_FPTextSuffix = `<br>Hit ${  IS_MAC ? String.fromCharCode(0x2318) : 'Ctrl'  }-c to copy to clipboard`
            var WMETB_FPTextObj = {
            pl: {
                link: newLink,
                text: WMETB_FPTextPrefix + newLink + WMETB_FPTextSuffix
            },
            forum: {
                link: `[url=${  newLink  }]Permalink[/url]`,
                text: `${WMETB_FPTextPrefix  }[url=${  newLink  }]Permalink[/url]${  WMETB_FPTextSuffix}`
            },
            lonlat: {
                link: `${lat  } ${  ns  } ${  lon  } ${  ew}`,
                text: `${lat  } ${  ns  } ${  lon  } ${  ew  }${WMETB_FPTextSuffix}`
            }
        }
        return (WMETB_FPTextObj);
    }

    var WMETB_FPdivPerma;
    var WMETB_FPaPerma;
    // var node;
    var WMETB_FPnodeWMEFP;
    var WMETB_FPcurLink;

    function getUrl(path) {
        return `https://raw.githubusercontent.com/mapomatic/WME-Toolbox-Public/main/images/${path}`;
    }

    function getImageHtml(imageName) {
        return `<img height='18px' width='18px' src='${getUrl(imageName)}' />`;
    }
    var WMETB_FPredlinkImg = getImageHtml('FP_redLink.png');
    var WMETB_FPbubblelinkImg = getImageHtml('FP_redbubbleLink.png');
    var WMETB_FPMURlinkImg = getImageHtml('FP_MURLink.png');
    var WMETB_FPclosurelinkImg = getImageHtml('FP_closureLink.png');
    var WMETB_FPunlocklinkImg = getImageHtml('FP_unlockLink.png');
    var WMETB_FPsmallredPM = getImageHtml('FP_redbubblePM.png');
    var WMETB_FPpmlinkImg = getImageHtml('FP_redbubblePM.png');
    var WMETB_FPsmallredpermalink = getImageHtml('FP_redLink.png');
    var WMETB_FPredpermalinkmulti = getImageHtml('FP_redbubbleALL.png');
    var WMETB_FPredLatLonImg = getImageHtml('FP_redlonlat.png');

    var WMETB_FPunlockForumSection = [];
    WMETB_FPunlockForumSection[10] = 'https://www.waze.com/forum/posting.php?mode=post&f=1150'; // Argentina
    WMETB_FPunlockForumSection[13] = 'https://www.waze.com/forum/posting.php?mode=post&f=406'; // Australia
    WMETB_FPunlockForumSection[14] = 'https://www.waze.com/forum/posting.php?mode=post&f=851'; // AUSTRIA
    WMETB_FPunlockForumSection[21] = 'https://www.waze.com/forum/posting.php?mode=post&f=383'; // BELGIUM
    WMETB_FPunlockForumSection[26] = 'https://www.waze.com/forum/posting.php?mode=reply&f=493&t=48591'; // Bolivia
    WMETB_FPunlockForumSection[30] = 'https://www.waze.com/forum/posting.php?mode=reply&f=299&t=63374'; // Brazil
    // Burma - 221
    WMETB_FPunlockForumSection[34] = 'https://www.waze.com/forum/posting.php?mode=post&f=1484'; // BULGARIA
    WMETB_FPunlockForumSection[35] = 'https://www.waze.com/forum/posting.php?mode=post&f=1857'; // Burkina
    WMETB_FPunlockForumSection[37] = 'https://www.waze.com/forum/posting.php?mode=reply&f=893&t=116763'; // Belarus
    WMETB_FPunlockForumSection[40] = 'https://www.waze.com/forum/posting.php?mode=post&f=358'; // CANADA
    WMETB_FPunlockForumSection[45] = 'https://www.waze.com/forum/posting.php?mode=post&f=827'; // Chile
    WMETB_FPunlockForumSection[49] = 'https://www.waze.com/forum/posting.php?mode=reply&f=450&t=41414'; // Colombia
    WMETB_FPunlockForumSection[53] = 'https://www.waze.com/forum/posting.php?mode=reply&f=501&t=42342'; // Costa Rica
    WMETB_FPunlockForumSection[54] = 'https://www.waze.com/forum/posting.php?mode=post&f=590'; // Croatia
    WMETB_FPunlockForumSection[55] = 'https://www.waze.com/forum/posting.php?mode=reply&f=1343&t=222854'; // Cuba
    WMETB_FPunlockForumSection[57] = 'https://www.waze.com/forum/posting.php?mode=post&f=274'; // Czech Republic
    WMETB_FPunlockForumSection[58] = 'https://www.waze.com/forum/posting.php?mode=post&f=1110'; // Denmark
    WMETB_FPunlockForumSection[61] = 'https://www.waze.com/forum/viewforum.php?f=1148'; // Dominican Republic
    WMETB_FPunlockForumSection[62] = 'https://www.waze.com/forum/posting.php?mode=reply&f=509&t=41303'; // Ecuador
    WMETB_FPunlockForumSection[63] = 'https://www.waze.com/forum/posting.php?mode=reply&f=550&t=41065'; // Egypt
    WMETB_FPunlockForumSection[64] = 'https://www.waze.com/forum/posting.php?mode=reply&f=517&t=48593'; // El Salvador
    WMETB_FPunlockForumSection[67] = 'https://www.waze.com/forum/posting.php?mode=reply&f=260&t=193722'; // Estonia
    WMETB_FPunlockForumSection[73] = 'https://www.waze.com/forum/posting.php?mode=post&f=244'; // FRANCE
    // Gaza Strip - 79
    WMETB_FPunlockForumSection[81] = 'https://www.waze.com/forum/posting.php?mode=post&f=850'; // GERMANY
    WMETB_FPunlockForumSection[85] = 'https://www.waze.com/forum/posting.php?mode=post&f=1306'; // GREECE
    WMETB_FPunlockForumSection[97] = 'https://www.waze.com/forum/posting.php?mode=reply&f=617&t=48497'; // Honduras
    WMETB_FPunlockForumSection[99] = 'https://www.waze.com/forum/posting.php?mode=reply&f=896&t=110405'; // Hungary
    WMETB_FPunlockForumSection[100] = 'https://www.waze.com/forum/posting.php?mode=reply&f=308&t=121020'; // Iceland
    WMETB_FPunlockForumSection[101] = 'https://www.waze.com/forum/posting.php?mode=post&f=561'; // India
    WMETB_FPunlockForumSection[102] = 'https://www.waze.com/forum/posting.php?mode=post&f=424'; // Indonesia
    WMETB_FPunlockForumSection[105] = 'https://www.waze.com/forum/posting.php?mode=post&f=1558'; // Ireland
    WMETB_FPunlockForumSection[106] = 'https://www.waze.com/forum/posting.php?mode=post&f=1548'; // Israel
    WMETB_FPunlockForumSection[107] = 'https://docs.google.com/spreadsheet/viewform?formkey=dHFyNHFxdTZueE85dmppaHFsd1VVS0E6MQ'; // Italy <- special case, they use Google Form
    WMETB_FPunlockForumSection[202] = 'https://www.waze.com/forum/posting.php?mode=post&f=324'; // Korea
    WMETB_FPunlockForumSection[120] = 'https://www.waze.com/forum/posting.php?mode=post&f=326'; // Kuwait
    WMETB_FPunlockForumSection[123] = 'https://www.waze.com/forum/posting.php?mode=reply&f=425&t=35738'; // Latvia
    WMETB_FPunlockForumSection[124] = 'https://www.waze.com/forum/posting.php?mode=reply&f=1447&t=143883'; // Lebanon
    WMETB_FPunlockForumSection[130] = 'https://www.waze.com/forum/posting.php?mode=post&f=386'; // LUXEMBOURG
    WMETB_FPunlockForumSection[145] = 'https://www.waze.com/forum/posting.php?mode=post&f=1433'; // Mexico
    WMETB_FPunlockForumSection[150] = 'https://www.waze.com/forum/posting.php?mode=post&f=1741'; // Montenegro
    WMETB_FPunlockForumSection[158] = 'https://www.waze.com/forum/posting.php?mode=post&f=382'; // NETHERLANDS
    WMETB_FPunlockForumSection[161] = 'https://www.waze.com/forum/posting.php?mode=reply&f=122&t=52883'; // New Zealand
    WMETB_FPunlockForumSection[169] = 'https://www.waze.com/forum/posting.php?mode=post&f=334'; // NORWAY
    WMETB_FPunlockForumSection[172] = 'https://www.waze.com/forum/posting.php?mode=post&f=1417'; // Pakistan
    WMETB_FPunlockForumSection[173] = 'https://www.waze.com/forum/posting.php?mode=reply&f=458&t=48594'; // Panama
    WMETB_FPunlockForumSection[176] = 'https://www.waze.com/forum/posting.php?mode=reply&f=359&t=65273'; // Paraguay
    WMETB_FPunlockForumSection[177] = 'https://www.waze.com/forum/posting.php?mode=reply&f=525&t=48595'; // Peru
    WMETB_FPunlockForumSection[178] = 'https://www.waze.com/forum/posting.php?mode=post&f=311'; // Philippines
    WMETB_FPunlockForumSection[181] = 'https://www.waze.com/forum/posting.php?mode=reply&f=611&t=32067'; // PORTUGAL
    WMETB_FPunlockForumSection[182] = 'https://www.waze.com/forum/posting.php?mode=post&f=1517'; // PUERTO RICO
    WMETB_FPunlockForumSection[184] = 'https://www.waze.com/forum/posting.php?mode=post&f=244'; // Réunion, as France
    WMETB_FPunlockForumSection[185] = 'https://www.waze.com/forum/posting.php?mode=reply&f=120&t=24536'; // Romania
    WMETB_FPunlockForumSection[186] = 'https://www.waze.com/forum/posting.php?mode=post&f=787'; // Russia
    WMETB_FPunlockForumSection[190] = 'https://www.waze.com/forum/posting.php?mode=reply&f=936&t=105146'; // Saudi Arabia
    WMETB_FPunlockForumSection[195] = 'https://www.waze.com/forum/posting.php?mode=post&f=191'; // Singapore
    WMETB_FPunlockForumSection[196] = 'https://www.waze.com/forum/posting.php?mode=post&f=275'; // Slovakia
    WMETB_FPunlockForumSection[200] = 'https://www.waze.com/forum/posting.php?mode=post&f=327'; // South Africa
    WMETB_FPunlockForumSection[203] = 'https://www.waze.com/forum/posting.php?mode=reply&f=206&t=62420'; // SPAIN
    WMETB_FPunlockForumSection[205] = 'https://www.waze.com/forum/posting.php?mode=post&f=1619'; // Sri Lanka
    WMETB_FPunlockForumSection[215] = 'https://www.waze.com/forum/posting.php?mode=post&f=773'; // Sweden
    WMETB_FPunlockForumSection[216] = 'https://www.waze.com/forum/posting.php?mode=post&f=852'; // SWITZERLAND
    WMETB_FPunlockForumSection[221] = 'https://www.waze.com/forum/posting.php?mode=post&f=1403'; // Thailand
    WMETB_FPunlockForumSection[227] = 'https://www.waze.com/forum/posting.php?mode=reply&f=198&t=42103'; // Turkey
    WMETB_FPunlockForumSection[233] = 'https://www.waze.com/forum/posting.php?mode=post&f=925'; // UAE
    WMETB_FPunlockForumSection[234] = 'https://www.waze.com/forum/posting.php?mode=post&f=375'; // UK
    WMETB_FPunlockForumSection[235] = 'https://www.waze.com/forum/posting.php?mode=post&f=622'; // US
    WMETB_FPunlockForumSection[236] = 'https://www.waze.com/forum/posting.php?mode=post&f=430'; // Uruguay
    WMETB_FPunlockForumSection[239] = 'https://www.waze.com/forum/posting.php?mode=reply&f=65&t=34442'; // Venezuela
    WMETB_FPunlockForumSection[244] = 'https://www.waze.com/forum/posting.php?mode=post&f=1548'; // West Bank
    // Rest of Central / South America
    WMETB_FPunlockForumSection[22] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Belize
    WMETB_FPunlockForumSection[69] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Falkland Islands (69 = Isla Malvinas)
    WMETB_FPunlockForumSection[74] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // French Guiana
    WMETB_FPunlockForumSection[90] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Guatemala
    WMETB_FPunlockForumSection[94] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Guyana
    WMETB_FPunlockForumSection[162] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Nicaragua
    // WMETB_FPunlockForumSection[999]="https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716"; // South Georgia and South Sandwich Islands
    WMETB_FPunlockForumSection[212] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Suriname
    WMETB_FPunlockForumSection[256] = 'https://www.waze.com/forum/posting.php?mode=post&f=1771'; // Hong Kong


    // others that use generic unlock forum - make sure to set WMETB_FPinclcountry below
    WMETB_FPunlockForumSection[208] = 'https://www.waze.com/forum/posting.php?mode=post&f=199'; // St Lucia

    var WMETB_FPmapupdateForumSection = [];
    WMETB_FPmapupdateForumSection[10] = 'https://www.waze.com/forum/posting.php?mode=post&f=1150'; // Argentina
    WMETB_FPmapupdateForumSection[13] = 'https://www.waze.com/forum/posting.php?mode=post&f=406'; // Australia
    WMETB_FPmapupdateForumSection[14] = 'https://www.waze.com/forum/posting.php?mode=post&f=851'; // AUSTRIA
    WMETB_FPmapupdateForumSection[21] = 'https://www.waze.com/forum/posting.php?mode=post&f=383'; // BELGIUM
    WMETB_FPmapupdateForumSection[26] = 'https://www.waze.com/forum/posting.php?mode=reply&f=493&t=48591'; // Bolivia
    WMETB_FPmapupdateForumSection[30] = 'https://www.waze.com/forum/posting.php?mode=reply&f=299&t=63374'; // Brazil
    // Burma - 221
    WMETB_FPmapupdateForumSection[34] = 'https://www.waze.com/forum/posting.php?mode=post&f=1484'; // BULGARIA
    WMETB_FPmapupdateForumSection[37] = 'https://www.waze.com/forum/posting.php?mode=reply&f=893&t=116763'; // Belarus
    WMETB_FPmapupdateForumSection[40] = 'https://www.waze.com/forum/posting.php?mode=post&f=358'; // CANADA
    WMETB_FPmapupdateForumSection[45] = 'https://www.waze.com/forum/posting.php?mode=post&f=827'; // Chile
    WMETB_FPmapupdateForumSection[49] = 'https://www.waze.com/forum/posting.php?mode=reply&f=450&t=41414'; // Colombia
    WMETB_FPmapupdateForumSection[53] = 'https://www.waze.com/forum/posting.php?mode=reply&f=501&t=42342'; // Costa Rica
    WMETB_FPmapupdateForumSection[54] = 'https://www.waze.com/forum/posting.php?mode=post&f=590'; // Croatia
    WMETB_FPmapupdateForumSection[55] = 'https://www.waze.com/forum/posting.php?mode=reply&f=1343&t=222854'; // Cuba
    WMETB_FPmapupdateForumSection[57] = 'https://www.waze.com/forum/posting.php?mode=post&f=274'; // Czech Republic
    WMETB_FPmapupdateForumSection[58] = 'https://www.waze.com/forum/posting.php?mode=post&f=1110'; // Denmark
    WMETB_FPmapupdateForumSection[61] = 'https://www.waze.com/forum/viewforum.php?f=1147'; // Dominican Republic
    WMETB_FPmapupdateForumSection[62] = 'https://www.waze.com/forum/posting.php?mode=reply&f=509&t=41303'; // Ecuador
    WMETB_FPmapupdateForumSection[63] = 'https://www.waze.com/forum/posting.php?mode=reply&f=550&t=41065'; // Egypt
    WMETB_FPmapupdateForumSection[64] = 'https://www.waze.com/forum/posting.php?mode=reply&f=517&t=48593'; // El Salvador
	WMETB_FPmapupdateForumSection[67] = 'https://www.waze.com/forum/posting.php?mode=reply&f=260&t=193722'; // Estonia
    WMETB_FPmapupdateForumSection[73] = 'https://www.waze.com/forum/posting.php?mode=post&f=549'; // FRANCE
    // Gaza Strip - 79
    WMETB_FPmapupdateForumSection[81] = 'https://www.waze.com/forum/posting.php?mode=post&f=850'; // GERMANY
    WMETB_FPmapupdateForumSection[85] = 'https://www.waze.com/forum/posting.php?mode=post&f=1306'; // GREECE
    WMETB_FPmapupdateForumSection[97] = 'https://www.waze.com/forum/posting.php?mode=reply&f=617&t=48497'; // Honduras
    WMETB_FPmapupdateForumSection[99] = 'https://www.waze.com/forum/posting.php?mode=reply&f=896&t=110405'; // Hungary
    WMETB_FPmapupdateForumSection[100] = 'https://www.waze.com/forum/posting.php?mode=reply&f=308&t=121020'; // Iceland
    WMETB_FPmapupdateForumSection[101] = 'https://www.waze.com/forum/posting.php?mode=post&f=561'; // India
    WMETB_FPmapupdateForumSection[102] = 'https://www.waze.com/forum/posting.php?mode=post&f=424'; // Indonesia
    WMETB_FPmapupdateForumSection[105] = 'https://www.waze.com/forum/posting.php?mode=post&f=1558'; // Ireland
    WMETB_FPmapupdateForumSection[106] = 'https://www.waze.com/forum/posting.php?mode=post&f=1546'; // Israel
    WMETB_FPmapupdateForumSection[202] = 'https://www.waze.com/forum/posting.php?mode=post&f=324'; // Korea
    WMETB_FPmapupdateForumSection[120] = 'https://www.waze.com/forum/posting.php?mode=post&f=326'; // Kuwait
    WMETB_FPmapupdateForumSection[123] = 'https://www.waze.com/forum/posting.php?mode=reply&f=425&t=35738'; // Latvia
    WMETB_FPmapupdateForumSection[124] = 'https://www.waze.com/forum/posting.php?mode=reply&f=1447&t=143883'; // Lebanon
    WMETB_FPmapupdateForumSection[130] = 'https://www.waze.com/forum/posting.php?mode=post&f=386'; // LUXEMBOURG
    WMETB_FPmapupdateForumSection[145] = 'https://www.waze.com/forum/posting.php?mode=post&f=1433'; // Mexico
    WMETB_FPmapupdateForumSection[150] = 'https://www.waze.com/forum/posting.php?mode=post&f=1742'; // Montenegro
    WMETB_FPmapupdateForumSection[158] = 'https://www.waze.com/forum/posting.php?mode=post&f=382'; // NETHERLANDS
    WMETB_FPmapupdateForumSection[161] = 'https://www.waze.com/forum/posting.php?mode=reply&f=122&t=52883'; // New Zealand
    WMETB_FPmapupdateForumSection[169] = 'https://www.waze.com/forum/posting.php?mode=post&f=334'; // NORWAY
    WMETB_FPmapupdateForumSection[172] = 'https://www.waze.com/forum/posting.php?mode=post&f=1417'; // Pakistan
    WMETB_FPmapupdateForumSection[173] = 'https://www.waze.com/forum/posting.php?mode=reply&f=458&t=48594'; // Panama
    WMETB_FPmapupdateForumSection[176] = 'https://www.waze.com/forum/posting.php?mode=reply&f=359&t=65273'; // Paraguay
    WMETB_FPmapupdateForumSection[177] = 'https://www.waze.com/forum/posting.php?mode=reply&f=525&t=48595'; // Peru
    WMETB_FPmapupdateForumSection[178] = 'https://www.waze.com/forum/posting.php?mode=post&f=311'; // Philippines
    WMETB_FPmapupdateForumSection[180] = 'https://www.waze.com/forum/posting.php?mode=post&f=795'; // Poland
    WMETB_FPmapupdateForumSection[181] = 'https://www.waze.com/forum/posting.php?mode=reply&f=611&t=32067'; // PORTUGAL
    WMETB_FPmapupdateForumSection[182] = 'https://www.waze.com/forum/posting.php?mode=post&f=1517'; // PUERTO RICO
    WMETB_FPmapupdateForumSection[184] = 'https://www.waze.com/forum/posting.php?mode=post&f=549'; // Réunion, as France
    WMETB_FPmapupdateForumSection[185] = 'https://www.waze.com/forum/posting.php?mode=reply&f=120&t=24536'; // Romania
    WMETB_FPmapupdateForumSection[186] = 'https://www.waze.com/forum/posting.php?mode=post&f=787'; // Russia
    WMETB_FPmapupdateForumSection[195] = 'https://www.waze.com/forum/posting.php?mode=post&f=191'; // Singapore
    WMETB_FPmapupdateForumSection[196] = 'https://www.waze.com/forum/posting.php?mode=post&f=275'; // Slovakia
    WMETB_FPmapupdateForumSection[200] = 'https://www.waze.com/forum/posting.php?mode=post&f=327'; // South Africa
    WMETB_FPmapupdateForumSection[203] = 'https://www.waze.com/forum/posting.php?mode=reply&f=206&t=62420'; // SPAIN
    WMETB_FPmapupdateForumSection[205] = 'https://www.waze.com/forum/posting.php?mode=post&f=1619'; // Sri Lanka
    WMETB_FPmapupdateForumSection[215] = 'https://www.waze.com/forum/posting.php?mode=post&f=773'; // Sweden
    WMETB_FPmapupdateForumSection[216] = 'https://www.waze.com/forum/posting.php?mode=post&f=852'; // SWITZERLAND
    WMETB_FPmapupdateForumSection[221] = 'https://www.waze.com/forum/posting.php?mode=post&f=1403'; // Thailand
    WMETB_FPmapupdateForumSection[227] = 'https://www.waze.com/forum/posting.php?mode=reply&f=198&t=42103'; // Turkey
    WMETB_FPmapupdateForumSection[233] = 'https://www.waze.com/forum/posting.php?mode=post&f=925'; // UAE
    WMETB_FPmapupdateForumSection[234] = 'https://www.waze.com/forum/posting.php?mode=post&f=375'; // UK
    WMETB_FPmapupdateForumSection[235] = 'https://www.waze.com/forum/posting.php?mode=post&f=622'; // US
    WMETB_FPmapupdateForumSection[236] = 'https://www.waze.com/forum/posting.php?mode=post&f=430'; // Uruguay
    WMETB_FPmapupdateForumSection[239] = 'https://www.waze.com/forum/posting.php?mode=reply&f=65&t=34442'; // Venezuela
    WMETB_FPmapupdateForumSection[244] = 'https://www.waze.com/forum/posting.php?mode=post&f=1546'; // West Bank
    WMETB_FPmapupdateForumSection[256] = 'https://www.waze.com/forum/posting.php?mode=post&f=1771'; // Hong Kong

    // Rest of Central / South America
    WMETB_FPmapupdateForumSection[22] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Belize
    WMETB_FPmapupdateForumSection[69] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Falkland Islands (69 = Isla Malvinas)
    WMETB_FPmapupdateForumSection[74] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // French Guiana
    WMETB_FPmapupdateForumSection[90] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Guatemala
    WMETB_FPmapupdateForumSection[94] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Guyana
    WMETB_FPmapupdateForumSection[162] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Nicaragua
    // WMETB_FPmapupdateForumSection[999] ="https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716"; // South Georgia and South Sandwich Islands
    WMETB_FPmapupdateForumSection[212] = 'https://www.waze.com/forum/posting.php?mode=reply&f=67&t=41716'; // Suriname

    // others that use generic unlock forum - make sure to set WMETB_FPinclcountry below
    WMETB_FPmapupdateForumSection[208] = 'https://www.waze.com/forum/posting.php?mode=post&f=199'; // St Lucia

    const WMETB_FPclosureForumSection = [];
    WMETB_FPclosureForumSection[13] = 'https://www.waze.com/forum/posting.php?mode=post&f=406'; // Australia
    WMETB_FPclosureForumSection[34] = 'https://www.waze.com/forum/posting.php?mode=post&f=1484'; // Bulgaria
    WMETB_FPclosureForumSection[55] = 'https://www.waze.com/forum/posting.php?mode=reply&f=1343&t=222856'; // Cuba
    WMETB_FPclosureForumSection[67] = 'https://www.waze.com/forum/posting.php?mode=reply&f=260&t=147494'; // Estonia
    WMETB_FPclosureForumSection[73] = 'https://www.waze.com/forum/posting.php?mode=post&f=1250'; // France
    WMETB_FPclosureForumSection[99] = 'https://www.waze.com/forum/posting.php?mode=reply&f=983&t=89365'; // Hungary
    WMETB_FPclosureForumSection[102] = 'https://www.waze.com/forum/posting.php?mode=post&f=1418'; // Indonesia
    WMETB_FPclosureForumSection[105] = 'https://www.waze.com/forum/posting.php?mode=post&f=1558'; // Ireland
    WMETB_FPclosureForumSection[106] = 'https://www.waze.com/forum/posting.php?mode=post&f=1546'; // Israel
    WMETB_FPclosureForumSection[124] = 'https://www.waze.com/forum/posting.php?mode=reply&f=1447&t=152773'; // Lebanon
    WMETB_FPclosureForumSection[158] = 'https://www.waze.com/forum/posting.php?mode=post&f=1145'; // Netherlands
    WMETB_FPclosureForumSection[161] = 'https://www.waze.com/forum/posting.php?mode=reply&f=122&t=52883'; // New Zealand
    WMETB_FPclosureForumSection[181] = 'https://www.waze.com/forum/posting.php?mode=post&f=611&t=173851'; // Portugal
    WMETB_FPclosureForumSection[182] = 'https://www.waze.com/forum/posting.php?mode=post&f=1517'; // PUERTO RICO
    WMETB_FPclosureForumSection[184] = 'https://www.waze.com/forum/posting.php?mode=post&f=1250'; // Réunion, as France
    WMETB_FPclosureForumSection[200] = 'https://www.waze.com/forum/posting.php?mode=post&f=327'; // South Africa
    WMETB_FPclosureForumSection[203] = 'https://www.waze.com/forum/posting.php?mode=reply&f=1638&t=193567'; // Spain
    WMETB_FPclosureForumSection[205] = 'https://www.waze.com/forum/posting.php?mode=post&f=1617'; // Sri Lanka
    WMETB_FPclosureForumSection[221] = 'https://www.waze.com/forum/posting.php?mode=post&f=1518'; // Thailand
    WMETB_FPclosureForumSection[233] = 'https://www.waze.com/forum/posting.php?mode=post&f=1519'; // UAE
    WMETB_FPclosureForumSection[234] = 'https://www.waze.com/forum/posting.php?mode=post&f=375'; // UK
    WMETB_FPclosureForumSection[256] = 'https://www.waze.com/forum/posting.php?mode=post&f=1771'; // Hong Kong

    // if this is defined, it will add country to end of city request
    var WMETB_FPinclcountry = [];
    WMETB_FPinclcountry[208] = 1;
    WMETB_FPinclcountry[221] = 1;
    WMETB_FPinclcountry[233] = 1;

    // if this is defined, it won't formulate a country forum post, but rather direct user to Google Form
    var WMETB_FPmapupdate_gform = [];
    var WMETB_FPunlock_gform = [];
    var WMETB_FPclosure_gform = [];
    //    WMETB_FPgform[107] = 1;

    WMETB_FPunlock_gform[54] = {
        url: 'https://docs.google.com/forms/d/1N5UKBWflq_2o99sP-l8fez38Fq4rF7twllj6pAwUu4I/viewform?edit_requested=true', // Croatia <- special case, they use Google Form
        usrName: {
            entry: 'entry_903600815'
        },
        // usrRank: { entry: "entry_1630613482", "0" : "1", "1" : "2", "2" : "3", "3" : "4", "4" : "5", "5" : "6" },
        message: {
            entry: 'entry_461046666'
        },
        permalink: {
            entry: 'entry_1300749653'
        },
        updateRequest: {
            entry: 'entry_269432155',
            yes: 'Da',
            no: 'Ne'
        },
        requestRank: {
            entry: 'entry_1979214050',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        cityName: {
            entry: 'entry_1228301159'
        }
    };
    WMETB_FPunlock_gform[77] = {
        url: 'https://docs.google.com/forms/d/1iw5AQN_bAQREQmhSuDFJIB3Q-eepCaXtM2-Y2NSUivM/viewform?edit_requested=true', // Gabon <- special case, they use Google Form
        usrName: {
            entry: 'entry_525650593'
        },
        usrRank: {
            entry: 'entry_1306852205',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        message: {
            entry: 'entry_2113509389'
        },
        permalink: {
            entry: 'entry_1444681382'
        },
        updateRequest: {
            entry: 'entry_847687335',
            yes: 'Yes',
            no: 'No'
        },
        requestRank: {
            entry: 'entry_1967069623',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        cityName: {
            entry: 'entry_1171364560'
        }
    };
    WMETB_FPunlock_gform[107] = {
        url: 'https://docs.google.com/forms/d/1v2iztVzR2BTP606W22EK8rGK9Qh92eIEAxVvAIYZNVg/viewform?formkey=dHFyNHFxdTZueE85dmppaHFsd1VVS0E6MQ', // Italy <- special case, they use Google Form
        usrName: {
            entry: 'entry_2462026'
        },
        usrRank: {
            entry: 'entry_1000009',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        message: {
            entry: 'entry_1000001'
        },
        permalink: {
            entry: 'entry_1000006'
        },
        updateRequest: {
            entry: 'entry_1000008',
            yes: 'Sì',
            no: 'No'
        },
        requestRank: {
            entry: 'entry_1000002',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        cityName: {
            entry: 'entry_1000007'
        }, // if null, use customField entry_11
        customField: [{
                entry: 'entry_1000005'
            }, {
                entry: 'entry_11'
            }
        ]// special fileds: Region and comune (sigla) => need special process for this country
    };
    WMETB_FPunlock_gform[133] = WMETB_FPunlock_gform[77]; // Madagascar -> same google form as Gabon
    WMETB_FPunlock_gform[137] = WMETB_FPunlock_gform[77]; // Mali -> same google form as Gabon
    WMETB_FPunlock_gform[153] = {
        url: 'https://docs.google.com/forms/d/1nFpy4FDAiwpSdQGmoipFQRgbHTzBAW57GDncrRFVQSM/viewform?edit_requested=true', // Mozambique <- special case, they use Google Form
        usrName: {
            entry: 'entry_525650593'
        },
        usrRank: {
            entry: 'entry_1306852205',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        message: {
            entry: 'entry_2113509389'
        },
        permalink: {
            entry: 'entry_1444681382'
        },
        updateRequest: {
            entry: 'entry_847687335',
            yes: 'Yes',
            no: 'No'
        },
        requestRank: {
            entry: 'entry_1967069623',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        cityName: {
            entry: 'entry_1171364560'
        }
    };
    WMETB_FPunlock_gform[214] = {
        url: 'https://docs.google.com/forms/d/1tY6Wdmayn32zzpcWSEEzFOlfIZkCTFCRD6ycJaWeQw4/viewform?edit_requested=true', // Swaziland <- special case, they use Google Form
        usrName: {
            entry: 'entry_525650593'
        },
        usrRank: {
            entry: 'entry_1306852205',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        message: {
            entry: 'entry_2113509389'
        },
        permalink: {
            entry: 'entry_1444681382'
        },
        updateRequest: {
            entry: 'entry_847687335',
            yes: 'Yes',
            no: 'No'
        },
        requestRank: {
            entry: 'entry_1967069623',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        cityName: {
            entry: 'entry_1171364560'
        }
    };
    WMETB_FPunlock_gform[220] = {
        url: 'https://docs.google.com/forms/d/1tHToL5TPtZ8qsifxEb18Wwtepe28M_5kgAr8EEULmU8/viewform?edit_requested=true', // Tanzania <- special case, they use Google Form
        usrName: {
            entry: 'entry_525650593'
        },
        usrRank: {
            entry: 'entry_1306852205',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        message: {
            entry: 'entry_2113509389'
        },
        permalink: {
            entry: 'entry_1444681382'
        },
        updateRequest: {
            entry: 'entry_847687335',
            yes: 'Yes',
            no: 'No'
        },
        requestRank: {
            entry: 'entry_1967069623',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6'
        },
        cityName: {
            entry: 'entry_1171364560'
        },
        customField: [{
                entry: 'entry_1113252444',
                '220': 'Tanzania',
                '28': 'Botswana',
                '250': 'Zimbabwe',
                '155': 'Namibia',
                '164': 'Nigeria'
            }
        ]
    };
    WMETB_FPunlock_gform[239] = {
        url: 'https://docs.google.com/forms/d/e/1FAIpQLScLgZklK8_t59mPsXye9fC1MVkELAaLe75UfOqKIAwf-sRcfg/viewform?edit_requested=true', // Venezuela <- special case, they use Google Form
        usrName: {
            entry: 'entry_948302122'
        },
        usrRank: {
            entry: 'entry_826242748',
            '0': '1',
            '1': '2',
            '2': '3',
            '3': '4'
        },
        message: {
            entry: 'entry_895597034'
        },
        permalink: {
            entry: 'entry_206429751'
        },
        updateRequest: {
            entry: 'entry_1926295103',
            yes: 'Reparación',
            no: 'Desbloqueo'
        },
        requestRank: {
            entry: 'entry_129626261',
            '1': '2',
            '2': '3',
            '3': '4',
            '4': '5',
            '5': '6',
            '6': 'Staff'
        },
        customField: [{
                entry: 'entry_1058818119',
                'force': 'Solicitando'
            }
        ]
    };
    WMETB_FPunlock_gform[28] = WMETB_FPunlock_gform[220]; // Botswana -> same google form as Tanzania
    WMETB_FPunlock_gform[250] = WMETB_FPunlock_gform[220]; // Zimbabwe -> same google form as Tanzania
    WMETB_FPunlock_gform[155] = WMETB_FPunlock_gform[220]; // Namibia -> same google form as Tanzania
    WMETB_FPunlock_gform[164] = WMETB_FPunlock_gform[220]; // Nigeria -> same google form as Tanzania
    // UAE now uses a forum, not a Google Form
    /* WMETB_FPunlock_gform[233] = { url: "https://docs.google.com/forms/d/1XZkjQq0ldVg29w2dhyqWHmqndZAQl_fvDKLXbAdo4pk/viewform?edit_requested=true", // UAE <- special case, they use Google Form
    usrName: { entry: "entry_525650593" },
    usrRank: { entry: "entry_1306852205", "0" : "1", "1" : "2", "2" : "3", "3" : "4", "4" : "5", "5" : "6" },
    message: { entry: "entry_2113509389" },
    permalink: { entry: "entry_1444681382" },
    updateRequest: { entry: "entry_847687335", yes: "Yes", no: "No"},
    requestRank: { entry: "entry_1967069623", "0" : "1", "1" : "2", "2" : "3", "3" : "4", "4" : "5", "5" : "6" },
    cityName: {entry: "entry_1171364560" }
    }; */
    WMETB_FPunlock_gform[170] = WMETB_FPunlock_gform[233]; // Oman -> same google form as UAE

    WMETB_FPmapupdate_gform[54] = WMETB_FPunlock_gform[54]; // Croatia: same google form
    WMETB_FPmapupdate_gform[77] = WMETB_FPunlock_gform[77]; // Gabon: same google form
    WMETB_FPmapupdate_gform[107] = WMETB_FPunlock_gform[107]; // Italy: same google form
    WMETB_FPmapupdate_gform[133] = WMETB_FPunlock_gform[133]; // Madagascar: same google form
    WMETB_FPmapupdate_gform[137] = WMETB_FPunlock_gform[137]; // Mali: same google form
    WMETB_FPmapupdate_gform[153] = WMETB_FPunlock_gform[153]; // Mozambique: same google form
    WMETB_FPmapupdate_gform[214] = WMETB_FPunlock_gform[214]; // Swaziland: same google form
    WMETB_FPmapupdate_gform[220] = WMETB_FPunlock_gform[220]; // Tanzania: same google form
    WMETB_FPmapupdate_gform[28] = WMETB_FPunlock_gform[28]; // Botswana: same google form
    WMETB_FPmapupdate_gform[250] = WMETB_FPunlock_gform[250]; // Zimbabwe: same google form
    WMETB_FPmapupdate_gform[155] = WMETB_FPunlock_gform[155]; // Namibia: same google form
    WMETB_FPmapupdate_gform[164] = WMETB_FPunlock_gform[164]; // Nigeria: same google form
    WMETB_FPmapupdate_gform[233] = WMETB_FPunlock_gform[233]; // UAE: same google form
    WMETB_FPmapupdate_gform[170] = WMETB_FPunlock_gform[170]; // Oman: same google form
    WMETB_FPmapupdate_gform[239] = WMETB_FPunlock_gform[239]; // Venezuela: same google form

    WMETB_FPclosure_gform[40] = {
        url: 'https://docs.google.com/forms/d/1qseeTLrjIW5eLVBuReJhxw0f5kqYtCVYyVsQMkxXJUY/viewform?edit_requested=true', // Canada <- special case, they use Google Form
        usrName: {
            entry: 'entry_1231818309'
        },
        permalink: {
            entry: 'entry_1369158071'
        },
        cityName: {
            entry: 'entry_49956184'
        },
        message: {
            entry: 'entry_526152942'
        }
    };

    WMETB_FPclosure_gform[81] = {
        url: 'https://docs.google.com/forms/d/1IIRRSWVh3Vq3YJLCzHgYGoCBNJ6ypxOJ1OhNenaFTos/viewform?edit_requested=true', // Germany <- special case, they use Google Form
        usrName: {
            entry: 'entry_223124222'
        },
        message: {
            entry: 'entry_124892065'
        },
        permalink: {
            entry: 'entry_954594384'
        },
        segIdList: {
            entry: 'entry_904144692'
        },
        cityName: {
            entry: 'entry_1863998332'
        },
        customField: [{
                entry: 'entry_792216132',
                '81': 'Deutschland',
                '14': 'Österreich',
                '216': 'Schweiz'
            }
        ]
    };
    WMETB_FPclosure_gform[14] = WMETB_FPclosure_gform[81]; // Austria share the same form as Germany
    WMETB_FPclosure_gform[216] = WMETB_FPclosure_gform[81]; // Switzerland share the same form as Germany

    WMETB_FPclosure_gform[235] = {
        url: 'https://docs.google.com/forms/d/1oGINt4UEkBV0Par5VCingXzTZpJq9KjG8GbZpGqbRow/viewform?edit_requested=true', // USA <- special case, they use Google Form
        usrName: {
            entry: 'entry_85893137'
        },
        permalink: {
            entry: 'entry_1404063047'
        },
        cityName: {
            entry: 'entry_1362518678'
        }
    };

    // ///////////// CUSTOM COUNTRY FUNCTIONS
    function WMETB_FP_ITALY_getRegion(lon, lat) {
        var xhr3_object = new XMLHttpRequest();
        var geocode = null;
        xhr3_object.addEventListener('readystatechange', function () {
            if (xhr3_object.readyState == 4) {
                try {
                    geocode = JSON.parse(xhr3_object.responseText);
                } catch (err) {
                    geocode = null;
                    log('Error while getting region for ITALY', err);
                }
            }
        }, false);
        xhr3_object.open('GET', `https://maps.googleapis.com/maps/api/geocode/json?language=it&latlng=${  lat  },${  lon}`, false);
        xhr3_object.send(null);
        // WMETB_FPlog("geocode", geocode);

        /*
        var regions=["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana", "Trentino-Alto Adige", "Umbria", "Valle D'Aosta", "Veneto"];
        for (var i=0; i<geocode.results.length; i++)
    {
        for (var j=0; j<regions.length; j++)
    {
        if (geocode.results[i].address_components[0].long_name==regions[j])
        return regions[j];
        }
        } */

        // Giovani optimization
        for (var i = 0; i < geocode.results[0].address_components.length; i++) {
            if (geocode.results[0].address_components[i].types.indexOf('administrative_area_level_1') != -1) {
                return geocode.results[0].address_components[i].long_name;
            }
        }
        return null;
    }

    log('ready');
    WMETB_FPinitializeWazeObjects();
})();
