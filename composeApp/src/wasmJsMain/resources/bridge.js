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

    // Riproduzione SOLO AUDIO (modalita' predefinita): l'URL dello stream audio
    // arriva da /stream del worker e viene riprodotto da un <audio> element.
    // Se il fetch fallisce (o l'audio da errore) si ricade sull'iframe video.
    var mode = null;             // null | 'audio' | 'video'
    var audioEl = null;
    var audioState = -1;         // stesso dominio di ytState (0 ended, 1 playing, ...)
    var loadSeq = 0;             // token anti-corse su load() asincrono
    var audioFallbackFor = null; // videoId per cui e' gia avvenuto il fallback video

    function apiBase() {
        try { return window.__RIPLAY_API__ || 'http://localhost:8787'; }
        catch (e) { return 'http://localhost:8787'; }
    }

    var host = null;

    function ensureHost() {
        // Re-query ad ogni chiamata: ComposeViewport rimuove i figli esistenti
        // del suo container, quindi l'host può sparire dal DOM (o risultare stale).
        host = document.getElementById('riplay-player-host');
        if (!host && document.body) {
            // Ricrea l'host se qualcuno lo ha rimosso (stili: #riplay-player-host in index.html)
            host = document.createElement('div');
            host.id = 'riplay-player-host';
            document.body.appendChild(host);
        }
        return host;
    }

    function createPlayer(videoId) {
        var h = ensureHost();
        if (!h) {
            console.warn('[RiPlay] player host unavailable, cannot create player');
            return;
        }
        h.classList.add('active');
        // YT.Player SOSTITUISCE l'elemento ricevuto con un iframe:
        // creiamo un div interno così #riplay-player-host resta nostro.
        var inner = document.createElement('div');
        h.innerHTML = '';
        h.appendChild(inner);
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

    /** <audio> element singleton con mappatura degli eventi sugli stati. */
    function ensureAudio() {
        if (audioEl) return audioEl;
        var a = new Audio();
        a.preload = 'auto';
        var only = function () { return mode === 'audio'; };
        a.addEventListener('loadstart', function () { if (only()) audioState = 3; });
        a.addEventListener('waiting', function () { if (only()) audioState = 3; });
        a.addEventListener('stalled', function () { if (only()) audioState = 3; });
        a.addEventListener('playing', function () { if (only()) audioState = 1; });
        a.addEventListener('pause', function () { if (only() && audioState !== 0) audioState = 2; });
        a.addEventListener('ended', function () { if (only()) audioState = 0; });
        a.addEventListener('error', function () {
            if (!only()) return;
            var vid = state.currentVideoId;
            console.warn('[RiPlay] audio stream error, falling back to video player');
            if (vid && audioFallbackFor !== vid) {
                // Un solo fallback per videoId: niente loop audio <-> video
                audioFallbackFor = vid;
                loadVideoIframe(vid);
            } else {
                audioState = -2; // errore di riproduzione
            }
        });
        audioEl = a;
        return a;
    }

    /** Percorso "video": YouTube IFrame API (caricamento originale). */
    function loadVideoIframe(videoId) {
        mode = 'video';
        var h = ensureHost();
        if (h) h.classList.add('active');
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
    }

    /** Percorso "audio-only": fetch URL da /stream + <audio>. Asincrono. */
    function loadAudioStream(videoId, seq) {
        fetch(apiBase() + '/stream?videoId=' + encodeURIComponent(videoId))
            .then(function (r) {
                if (!r.ok) throw new Error('stream HTTP ' + r.status);
                return r.json();
            })
            .then(function (j) {
                if (seq !== loadSeq) return; // caricamento annullato da un altro load()
                if (!j || !j.url) throw new Error('missing url');
                mode = 'audio';
                var a = ensureAudio();
                audioState = 3; // buffering fino a 'playing'
                a.src = j.url;
                var p = a.play();
                if (p && p.catch) p.catch(function () {
                    // autoplay rifiutato dalla politica del browser: resta in pausa
                    if (mode === 'audio' && audioState === 3) audioState = 2;
                });
            })
            .catch(function (e) {
                if (seq !== loadSeq) return;
                console.warn('[RiPlay] audio-only unavailable (' + e.message + '), using video player');
                loadVideoIframe(videoId);
            });
    }

    window.riplay = {
        /**
         * Carica e riproduci: prova prima lo stream SOLO AUDIO (veloce, niente
         * video); se non disponibile ricade sull'iframe video. Asincrono.
         */
        load: function (videoId) {
            state.currentVideoId = videoId;
            audioFallbackFor = null;
            var seq = ++loadSeq;
            if (audioEl) { try { audioEl.pause(); } catch (e) {} }
            // Nascondi un eventuale video ancora visibile della modalita' precedente
            if (mode === 'video') {
                var hv = ensureHost();
                if (hv) hv.classList.remove('active', 'expanded');
                state.expanded = false;
            }
            loadAudioStream(videoId, seq);
            return true;
        },
        play: function () {
            if (mode === 'audio') {
                if (audioEl) { var p = audioEl.play(); if (p && p.catch) p.catch(function () {}); }
            } else if (state.player && state.ready) {
                state.player.playVideo();
            }
        },
        pause: function () {
            if (mode === 'audio') {
                if (audioEl) audioEl.pause();
            } else if (state.player && state.ready) {
                state.player.pauseVideo();
            }
        },
        seek: function (seconds) {
            if (mode === 'audio') {
                if (audioEl) { try { audioEl.currentTime = seconds; } catch (e) {} }
            } else if (state.player && state.ready) {
                state.player.seekTo(seconds, true);
            }
        },
        setVolume: function (v) {
            if (mode === 'audio') {
                if (audioEl) audioEl.volume = Math.max(0, Math.min(1, v / 100));
            } else if (state.player && state.ready) {
                state.player.setVolume(v);
            }
        },
        getPosition: function () {
            if (mode === 'audio') return (audioEl && audioEl.currentTime) || 0;
            if (state.player && state.ready) {
                try { return state.player.getCurrentTime() || 0; } catch (e) { return 0; }
            }
            return 0;
        },
        getDuration: function () {
            if (mode === 'audio') return (audioEl && audioEl.duration) || 0;
            if (state.player && state.ready) {
                try { return state.player.getDuration() || 0; } catch (e) { return 0; }
            }
            return 0;
        },
        /** -2=errore, -1=cued/nessuno, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued */
        getState: function () {
            if (mode === 'audio') return audioState;
            if (state.player && state.ready) {
                try { return state.player.getPlayerState(); } catch (e) { return -1; }
            }
            return -1;
        },
        isReady: function () {
            if (mode === 'audio') return !!(audioEl && audioEl.src);
            if (mode === 'video') return state.ready;
            return false;
        },
        /** true quando si sta riproducendo il video (iframe), non l'audio puro */
        isVideoMode: function () { return mode === 'video'; },
        getCurrentVideoId: function () { return state.currentVideoId; },
        showHost: function () {
            if (mode !== 'video') return; // in modalita' audio non c'e' video da mostrare
            var h = ensureHost();
            if (h) h.classList.add('active');
        },
        hideHost: function () {
            var h = ensureHost();
            if (h) h.classList.remove('active');
        },
        toggleExpand: function () {
            if (mode !== 'video') return false; // niente video da ingrandire
            var h = ensureHost();
            if (!h) return false;
            state.expanded = !state.expanded;
            h.classList.toggle('expanded', state.expanded);
            return state.expanded;
        },
        /** Ferma tutto (audio e/o video) e nasconde l'host */
        stop: function () {
            if (audioEl) {
                try { audioEl.pause(); audioEl.removeAttribute('src'); audioEl.load(); } catch (e) {}
            }
            if (state.player && state.ready) {
                try { state.player.stopVideo(); } catch (e) {}
            }
            mode = null;
            audioState = -1;
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
