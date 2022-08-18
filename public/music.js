const synths = {}
let playing = false;
let loopId = false;
let longLoad = false;

async function main(){
  // Clear error first.
  setError("");

  if (playing) { // Stop things.
    console.log("Stopping");
    Tone.Transport.stop();
    playing = false;
    clearInterval(loopId);
    return;
  }

  // Otherwise, set playing to true.
  console.log("Starting");
  playing = true;
  loadNextSet(); // Kick off right away.
  loopId = setInterval(loadNextSet, 30000);
}

async function loadNextSet(){
  console.log(`Looking to load ${playing}.`);
  if (!playing) {
    return;
  }
  console.log("Fetching next set.");

  const data = getLatency();
  if (data instanceof Promise){
    const output = await data
    if (!output) {
      playing = false;
      return;
    }

    for (const [agent, _] of Object.entries(output.agents)) {
      startSynth(agent);
    };

    const notes = {};
    const lastNotes = {};
    output.events.forEach(event => {
      setSpin('none');
      for (const [agent, value] of Object.entries(event)) {
        if (agent != "timestamp") {
          if (value.event == "error") {
            setError(value.cause);
            continue;
          }

          if (!(agent in notes)) {
            notes[agent] = [];
          }
          if (!(agent in lastNotes)) {
            lastNotes[agent] = {};
          }
          midi = (value.rtt + 50) % 128;
          if (lastNotes[agent].note) {
            delta = Math.abs(lastNotes[agent].note - midi);
            if (delta > 10) {
              if (lastNotes[agent].set == null) {
                lastNotes[agent].set = [midi];
              } else {
                notes[agent] = notes[agent].concat([lastNotes[agent].set]);
                //console.log(`Adding ${lastNotes[agent].set}`);
                lastNotes[agent].set = null;
              }
            } else {
              if (lastNotes[agent].set == null) {
                lastNotes[agent].set = [];
              }
              lastNotes[agent].set.push(midi);
            }
          }
          lastNotes[agent].note = midi;
          notes[agent].push(midi);
        }
      }
    });


    for (const [agent, n] of Object.entries(notes)) {
      console.log(`Looping ${agent}, ${n}`);

      const seq = new Tone.Sequence((time, note) => {
        let duration = "8n";
        if (synths[agent].type == "nsynth") {
          duration = "8n";
        }
	synths[agent].synth.triggerAttackRelease(Tone.Frequency(note, "midi").toFrequency(), duration, time);
      }, n).start(0);
    }

    if (Tone.context.state !== 'running') {
      Tone.context.resume();
      await Tone.start();
    }

    Tone.Transport.start();
    playing = true;
  }
}

async function startSynth(agent) {
  if (!(agent in synths)) {
    numAgents = Object.keys(synths).length;
    switch (numAgents) {
    case 0:
      synths[agent] = {
        synth: new Tone.Synth().toDestination(),
        type: "synth",
      };
      console.log(`Starting synth for ${agent}`);
      return;
    case 1:
      synths[agent] = {
        synth: new Tone.Synth().toDestination(),
        type: "nsynth",
      };
      console.log(`Starting noise synth for ${agent}`);
      return;
    case 2:
      synths[agent] = {
        synth: new Tone.FMSynth().toDestination(),
        type: "fmsynth",
      };
      console.log(`Starting fmsynth for ${agent}`);
      return;
    default:
      synths[agent] = {
        synth: new Tone.Synth().toDestination(),
        type: "synth",
      };
      console.log(`Starting synth for ${agent}`);
      return;
    }
  }
}

async function setSpin(vis) {
  [].forEach.call(document.querySelectorAll('.spinner'), function (el) {
    el.style.display = vis;
  });

  if (vis == "flex") {
    longLoad = setTimeout(() => {
      setError("This can take up to 60 seconds to load a new URL. Please be patient.");
    }, "3000");
  } else {
    if (longLoad != null) {
      clearTimeout(longLoad);
      longLoad = null;
      setError("");
    }
  }
}

async function getLatency() {
  let url = document.getElementById("url").value.trim();
  if (url == ""){
    return false;
  }

  if (!url.startsWith("https://")) {
    url = "https://" + url;
  }

  console.log(`getting latency for ${url}`);
  setSpin('flex');
  try{
    const response = await fetch('https://ancient-butterfly-eff0.kentiklabs.workers.dev/api/v1/data', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({target: url})
    });
    return await response.json();
  } catch(error) {
    console.log("Error");
    setError(error);
    return false;
  }
}

async function setError(msg) {
  var error = document.getElementById("error-msg");
  error.textContent = msg;
  if (msg != "") {
    error.style.color = "red";
  }
}

async function unMute() {
  // Create an audio context instance if WebAudio is supported
  let context = Tone.Transport.context.rawContext;

  // Decide on some parameters
  let allowBackgroundPlayback = false; // default false, recommended false
  let forceIOSBehavior = false; // default false, recommended false
  // Pass it to unmute if the context exists... ie WebAudio is supported
  if (context) {
    // If you need to be able to disable unmute at a later time, you can use the returned handle's dispose() method
    // if you don't need to do that (most folks won't) then you can simply ignore the return value
    let unmuteHandle = unmute(context, allowBackgroundPlayback, forceIOSBehavior);
    console.log("Unmuted");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("url").focus();
  document.getElementById("play-button").addEventListener("click", main)
  document.getElementById("url").addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.keyCode == 32) { // On space bar also stop/start playing.
      main();
    }
  });

  // Do both now and after we have a user action.
  unMute();
  USER_ACTIVATION_EVENTS.forEach(eventName => {
    window.addEventListener(
      eventName, handleUserActivation, { capture: true, passive: true }
    )
  });
});

const USER_ACTIVATION_EVENTS = [
  'auxclick',
  'click',
  'contextmenu',
  'dblclick',
  'keydown',
  'keyup',
  'mousedown',
  'mouseup',
  'touchend'
]

// state can be 'blocked', 'pending', 'allowed'
let htmlAudioState = 'blocked'

function handleUserActivation (e) {
  if (htmlAudioState === 'blocked') {
    htmlAudioState = 'pending'
    unMute();
  }
}
