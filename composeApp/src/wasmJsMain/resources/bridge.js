/**
 * RiPlay Web - bridge tra Kotlin/Wasm e la YouTube IFrame Player API.
 * Espone window.riplay: unico punto di contatto chiamato dal codice Kotlin.
 *
 * Nessuna dipendenza esterna: usa solo la YT IFrame API caricata da index.html.
 */
(function () {
    'use strict';

    var state = {
        player: null,
        ready: false,
        pendingVideoId: null,
        currentVideoId: null,
        position: 0,
        duration: 0,
        ytState: -1,          // -1 cued, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
        expanded: false,
        onEnded: null         // callback opzionale (non usata da Kotlin: usiamo il polling)
    };

    var host = null;

    function ensureHost() {
        if (!host) {
            host = document.getElementById('riplay-player-host');
        }
        return host;
    }

    function createPlayer(videoId) {
        ensureHost();
        host.classList.add('active');
        // YT.Player SOSTITUISCE l'elemento ricevuto con un iframe:
        // creiamo un div interno così #riplay-player-host resta nostro.
        var inner = document.createElement('div');
        host.innerHTML = '';
        host.appendChild(inner);
        state.player = new YT.Player(inner, {
            videoId: videoId,
            playerVars: {
                autoplay: 1,
                controls: 0,            // controlli gestiti dall'UI di RiPlay
                disablekb: 1,
                modestbranding: 1,
                rel: 0,
                playsinline: 1,
                origin: window.location.origin
            },
            events: {
                onReady: function () {
                    state.ready = true;
                    if (state.player && state.pendingVideoId) {
                        state.player.loadVideoById(state.pendingVideoId);
                        state.pendingVideoId = null;
                    }
                },
                onStateChange: function (e) {
                    state.ytState = e.data;
                },
                onError: function () {
                    state.ytState = -2; // segnale errore riproduzione
                }
            }
        });
    }

    window.riplay = {
        /** Carica e riproduci un video (crea il player se necessario) */
        load: function (videoId) {
            state.currentVideoId = videoId;
            if (typeof YT === 'undefined' || !YT.Player) {
                state.pendingVideoId = videoId;
                return false;
            }
            if (!state.player) {
                createPlayer(videoId);
            } else if (state.ready) {
                state.player.loadVideoById(videoId);
            } else {
                state.pendingVideoId = videoId;
            }
            return true;
        },
        play: function () {
            if (state.player && state.ready) state.player.playVideo();
        },
        pause: function () {
            if (state.player && state.ready) state.player.pauseVideo();
        },
        seek: function (seconds) {
            if (state.player && state.ready) state.player.seekTo(seconds, true);
        },
        setVolume: function (v) {
            if (state.player && state.ready) state.player.setVolume(v);
        },
        getPosition: function () {
            if (state.player && state.ready) {
                try { return state.player.getCurrentTime() || 0; } catch (e) { return 0; }
            }
            return 0;
        },
        getDuration: function () {
            if (state.player && state.ready) {
                try { return state.player.getDuration() || 0; } catch (e) { return 0; }
            }
            return 0;
        },
        /** -2=errore, -1=cued/nessuno, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued */
        getState: function () {
            if (state.player && state.ready) {
                try { return state.player.getPlayerState(); } catch (e) { return -1; }
            }
            return -1;
        },
        isReady: function () { return state.ready; },
        getCurrentVideoId: function () { return state.currentVideoId; },
        showHost: function () {
            var h = ensureHost();
            if (h) h.classList.add('active');
        },
        hideHost: function () {
            var h = ensureHost();
            if (h) h.classList.remove('active');
        },
        toggleExpand: function () {
            var h = ensureHost();
            if (!h) return false;
            state.expanded = !state.expanded;
            h.classList.toggle('expanded', state.expanded);
            return state.expanded;
        },
        /** Rimuovi il video (ferma e nasconde l'host) */
        stop: function () {
            if (state.player && state.ready) {
                try { state.player.stopVideo(); } catch (e) {}
            }
            state.currentVideoId = null;
            var h = ensureHost();
            if (h) h.classList.remove('active', 'expanded');
            state.expanded = false;
        }
    };

    /** Chiamata dalla YT API quando l'iframe è pronto */
    window.onYouTubeIframeAPIReady = function () {
        if (state.pendingVideoId && !state.player) {
            createPlayer(state.pendingVideoId);
            state.pendingVideoId = null;
        }
    };
})();
