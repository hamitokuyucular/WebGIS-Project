// Haritayı oluştur
var map = L.map('map', { zoomControl:true }).setView([39.0, 35.0], 6);
    
 // Altlık harita ekle
var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Layer control nesnesi
var baseMaps = {"OSM": osm};
var overlays = {};
var layerControl = L.control.layers(baseMaps, overlays).addTo(map);

const btnGeojson = document.getElementById("btn-geojson");
const btnShapefile = document.getElementById("btn-shp");
const fileInput = document.getElementById("file-input");

btnGeojson.addEventListener('click', () => {
  fileInput.accept= ".json, .geojson";
  fileInput.click();
});

btnShapefile.addEventListener('click', () => {
  fileInput.accept= ".zip";
  fileInput.click();
});

fileInput.addEventListener('change', fileLoader);

function fileLoader(e){
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name;
  const fileExtension = fileName.split(".").pop().toLowerCase();
  
  if (fileExtension == "json" || fileExtension== "geojson") {
    const reader = new FileReader();
    reader.onload = function(e) {
      const geojson = JSON.parse(e.target.result);
      addGeojsonToMap(geojson, file.name);
    }
    reader.readAsText(file);
    
  } else if (fileExtension == "zip") {
    async function loadShapefile(file) {
      const arrayBuffer = await file.arrayBuffer();
      const geojson = await shp(arrayBuffer);
      addGeojsonToMap(geojson, file.name);
    }
    loadShapefile(file)
  }
}

let savedLayers = [];

function addGeojsonToMap(geojson, name){
  const layer = L.geoJSON(geojson, {
    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng, {
        radius:6,
        color: 'black',
        fillColor: 'blue',
        weight: 1,
        fillOpacity: 0.7
      });
    },
    onEachFeature: function (feature, layer) {
      if (feature.properties) {
        let props = feature.properties;
        let content = "";
        for (let key in props) {
          content += key + ": " + props[key] + "<br>";
        }
        layer.bindPopup(content);
      }

      layer.on('click', function(e) {
        if (analysisMode.checked) {
          selectFeatureForAnalysis(layer, feature);
        }
      });
    }
  }).addTo(map);

  const layerInfo = {
    name: name,
    layer: layer,
    geojson: geojson
  };

  map.fitBounds(layer.getBounds());  
  overlays[name] = layer;
  layerControl.addOverlay(layer, name);

  savedLayers.push(layerInfo);
  aditLayerListDiv ()
  editTargetLayerSelect();
}


const layerList = document.getElementById("layer-list")

function aditLayerListDiv () {
  layerList.innerHTML = '';

  if (savedLayers.length === 0) {
    layerList.innerHTML = `
      <div class="instructions">
        <p>Katman listesi boş. Görüntülemek veya analiz yapmak için veri yükeyin.</p>
      </div>
    `;
    return;
  }

  savedLayers.forEach((layerInfo, index) => {
    const layerItem = document.createElement("div");
    
    layerItem.innerHTML = `
      <div class="layer-name">${layerInfo.name}</div>
      <div class="layer-actions">
        <button class="zoom-layer btn btn-primary" data-index="${index}">Zoom</button>
        <button class="remove-layer btn btn-danger" data-index="${index}">Kaldır</button>
      </div>
    `;
    layerList.appendChild(layerItem);
  });

  document.querySelectorAll(".remove-layer").forEach(button => {
    button.addEventListener('click', function(){
      const index = parseInt(this.getAttribute("data-index"));
      removeLayer(index)
    });
  });

  document.querySelectorAll(".zoom-layer").forEach(button => {
    button.addEventListener('click', function() {
      const index = parseInt(this.getAttribute("data-index"));
      zoomToLayer(index);
    });
  });
}

function removeLayer(index) {
  const layerInfo = savedLayers[index];
  map.removeLayer(layerInfo.layer);
  layerControl.removeLayer(layerInfo.layer);
  savedLayers.splice(index,1);

  aditLayerListDiv();
  editTargetLayerSelect();
}

function zoomToLayer(index) {
  const layerInfo = savedLayers[index];
  map.fitBounds(layerInfo.layer.getBounds());
}

const analysisMode = document.getElementById("analysis-mode")
const infoMode = document.getElementById("info-mode")
const analysisDiv = document.getElementById("div-analysis")

analysisMode.addEventListener('change', Modes)
infoMode.addEventListener('change', Modes)

let selectedLayer = null;
let selectedFeature = null;

function selectFeatureForAnalysis(layer, feature){
  selectedLayer = layer;
  selectedFeature = feature;

  selectedFeatureView(layer);
  map.fitBounds(layer.getBounds());
}

function Modes(){
  if (analysisMode.checked) {
    analysisDiv.classList.remove('hidden');

    if (selectedLayer) {
      selectedLayer = null
      selectedFeature = null
    }
  } else {
    analysisDiv.classList.add('hidden')
  }
}

const targetLayerSelect = document.getElementById("target-layer")

function editTargetLayerSelect() {
  targetLayerSelect.innerHTML = '<option value="">Katman seçin</option>';

  savedLayers.forEach(layerInfo => {
    const option = document.createElement('option');
    option.value = layerInfo.name;
    option.textContent = layerInfo.name;
    targetLayerSelect.appendChild(option);
  });
}


function selectedFeatureView(layer) {
  if (layer.feature && layer.feature.geometry) {
    const geometryType = layer.feature.geometry.type;
    if (geometryType == 'Point' || geometryType == 'MultiPoint') {
      layer.setStyle({
        radius: 6,
        weight: 1,
        color: 'black',
        fillColor: 'red',
        fillOpacity: 0.7
      });
    } else {
      layer.setStyle({
        color: 'red',
        weight: 1
      })
    }
  }
}

const intersectBtn = document.getElementById('intersect-btn');
const withinBtn = document.getElementById('within-btn');

intersectBtn.addEventListener('click', () => executeAnalysis('intersect'));
withinBtn.addEventListener('click', () => executeAnalysis('within'));

function executeAnalysis(analysisType) {
  const targetLayerName = targetLayerSelect.value;
  const targetLayerInfo = savedLayers.find(
    layer => layer.name == targetLayerName
  );

  let resultsFeatures = []

  const selectedFeature_Truf = turf.feature(
    selectedFeature.geometry,
    selectedFeature.properties
  );

  targetLayerInfo.geojson.features.forEach(targetFeature => {
    const targetFeature_Turf = turf.feature(
      targetFeature.geometry,
      targetFeature.properties
    );

    if (analysisType == "within") {
      if (turf.booleanWithin(targetFeature_Turf, selectedFeature_Truf)) {
        resultsFeatures.push(targetFeature);
      }
    } else if (analysisType == "intersect") {
      if (turf.booleanIntersects(targetFeature_Turf, selectedFeature_Truf)) {
        resultsFeatures.push(targetFeature);
      }
    }
  });
  analysisResults(resultsFeatures, analysisType, targetLayerName);
}

const resultsDiv = document.getElementById("result-div")
const results = document.getElementById("results")
const resultsDownloadBtn = document.getElementById("download-results")

// show results
function analysisResults(features, analysisType, targetLayerName) {
  if (features.length === 0) {
    results.innerHTML = `<p>Sonuç bulunamadı.</p>`;
    resultsDownloadBtn.classList.add('hidden');
    resultsDiv.classList.remove('hidden');
    return;
  }

  analysisResultsAddToMap = L.geoJSON({
    type: 'FeatureCollection',
    features: features
  }, {
    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng, {
        radius: 8,
        weight: 1,
        color: 'black',
        fillColor: 'green',
        fillOpacity: 0.7
      });
    },
    style: {
      color: 'green',
      weight: 3
    }
  }).addTo(map);

  results.innerHTML = `
  <p><strong>Analiz Türü:</strong> ${analysisType}</p>
  <p><strong>Hedef Katman:</strong> ${targetLayerName}</p>
  <p><strong>Bulunan Özellik Sayısı:</strong> ${features.length}</p>
  `;

  if (features.length > 0) {
    results.innerHTML += '<p><strong>Özellikler:</strong></p>';

    const resultsTable = document.createElement("table");
    resultsTable.classList.add("table", "table-bordered","border-dark")
    const rowTitles = document.createElement("tr");

    const properties = Object.keys(features[0].properties);
    properties.forEach(prop => {
      const th = document.createElement("th")
      th.textContent = prop;
      rowTitles.appendChild(th);
    });
    resultsTable.appendChild(rowTitles);

    features.slice(0,5).forEach(feature => {
      const row = document.createElement("tr");
      properties.forEach(prop => {
        const td = document.createElement("td");
        td.textContent = feature.properties[prop] !== null ? feature.properties[prop] : 'null';
        row.appendChild(td);
      });
      resultsTable.appendChild(row);
    });
    results.appendChild(resultsTable);

    resultsDownloadBtn.classList.remove('hidden');
  } else {
    resultsDownloadBtn.classList.add('hidden');
  }
  resultsDiv.classList.remove('hidden');
}
