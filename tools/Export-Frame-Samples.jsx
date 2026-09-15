// Export-Frame-Samples.jsx
//
// Samples the REAL, evaluated value (expressions included) of every property on the
// selected layer(s), at every single frame of the active composition, and writes it
// to a JSON file. This captures the exact motion curve - no guessing at bezier ease.
//
// HOW TO USE:
//   1. Open the comp with the pill animation (e.g. "pill_Without Descenders").
//   2. In the timeline, select the layer(s) you want captured - at minimum the pill
//      shape layer and the username text layer. Shift-click to select both.
//   3. File > Scripts > Run Script File... and choose this file.
//      (If that's greyed out: Edit > Preferences > Scripting & Expressions >
//       enable "Allow Scripts to Write Files and Access Network".)
//   4. Choose where to save - name it something like "pill-motion-samples.json"
//      and send that file back.
//
// If no layers are selected when you run it, it samples every layer in the comp.

(function () {
  function jsonEscape(s) {
    return String(s)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }

  function toJSON(value) {
    if (value === null || value === undefined) return "null";
    if (typeof value === "number") {
      if (isNaN(value) || !isFinite(value)) return "null";
      return String(value);
    }
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return '"' + jsonEscape(value) + '"';
    if (value instanceof Array) {
      var parts = [];
      for (var i = 0; i < value.length; i++) parts.push(toJSON(value[i]));
      return "[" + parts.join(",") + "]";
    }
    if (typeof value === "object") {
      var kv = [];
      for (var k in value) {
        if (value.hasOwnProperty(k)) {
          kv.push('"' + jsonEscape(k) + '":' + toJSON(value[k]));
        }
      }
      return "{" + kv.join(",") + "}";
    }
    return "null";
  }

  var comp = app.project.activeItem;
  if (!comp || !(comp instanceof CompItem)) {
    alert("Open/select the composition first, then run this script.");
    return;
  }

  var layers = [];
  if (comp.selectedLayers.length > 0) {
    layers = comp.selectedLayers;
  } else {
    for (var i = 1; i <= comp.numLayers; i++) layers.push(comp.layer(i));
  }

  var fps = comp.frameRate;
  var totalFrames = Math.round(comp.duration * fps);

  function collectProps(propGroup, path, list) {
    for (var i = 1; i <= propGroup.numProperties; i++) {
      var prop;
      try {
        prop = propGroup.property(i);
      } catch (e) {
        continue;
      }
      if (!prop) continue;
      if (prop.propertyType === PropertyType.PROPERTY) {
        list.push({ prop: prop, path: path + " > " + prop.name });
      } else if (
        prop.propertyType === PropertyType.INDEXED_GROUP ||
        prop.propertyType === PropertyType.NAMED_GROUP
      ) {
        collectProps(prop, path + " > " + prop.name, list);
      }
    }
  }

  var output = {
    fps: fps,
    totalFrames: totalFrames,
    compWidth: comp.width,
    compHeight: comp.height,
    layers: [],
  };

  for (var li = 0; li < layers.length; li++) {
    var layer = layers[li];
    var propList = [];
    collectProps(layer, layer.name, propList);

    var layerData = {
      name: layer.name,
      index: layer.index,
      inPoint: layer.inPoint,
      outPoint: layer.outPoint,
      properties: [],
    };

    for (var p = 0; p < propList.length; p++) {
      var entry = propList[p];
      var prop = entry.prop;

      if (prop.propertyValueType === PropertyValueType.NO_VALUE) continue;
      if (prop.propertyValueType === PropertyValueType.TEXT_DOCUMENT) continue;
      if (prop.propertyValueType === PropertyValueType.MARKER) continue;
      if (prop.propertyValueType === PropertyValueType.CUSTOM_VALUE) continue;
      if (prop.propertyValueType === PropertyValueType.LAYER_INDEX) continue;
      if (prop.propertyValueType === PropertyValueType.MASK_INDEX) continue;
      if (prop.propertyValueType === PropertyValueType.SHAPE) continue; // path shapes - separate handling if ever needed

      var isAnimated = prop.numKeys > 0 || prop.expressionEnabled;
      if (!isAnimated) {
        // still record the static value once, cheap and useful for context
        try {
          layerData.properties.push({
            path: entry.path,
            isStatic: true,
            value: prop.value,
          });
        } catch (e) {}
        continue;
      }

      var samples = [];
      var ok = true;
      try {
        for (var f = 0; f <= totalFrames; f++) {
          var t = f / fps;
          samples.push(prop.valueAtTime(t, false));
        }
      } catch (e) {
        ok = false;
      }
      if (ok) {
        layerData.properties.push({ path: entry.path, isStatic: false, samples: samples });
      }
    }

    output.layers.push(layerData);
  }

  var file = File.saveDialog("Save motion sample JSON", "*.json");
  if (file) {
    file.open("w");
    file.write(toJSON(output));
    file.close();
    alert("Saved: " + file.fsName);
  }
})();
