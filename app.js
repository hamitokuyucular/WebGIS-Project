// Haritayı oluştur
var map = L.map('map', { zoomControl:true }).setView([39.0, 35.0], 6);

 // Altlık harita ekle
var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Çizim özelliklerini belirle
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
  
var drawControl = new L.Control.Draw({
  edit: {
      featureGroup: drawnItems // düzenleme yapılacak layer
  },
  draw: {
    polygon: true,
    polyline: true,
    rectangle: true,
    circle: true,
    marker: true
  }
});

map.addControl(drawControl);
map.on(L.Draw.Event.CREATED, function (event) {
    var layer = event.layer;
    drawnItems.addLayer(layer); // çizilen objeyi haritaya ekle
    console.log(layer.toGeoJSON()); // GeoJSON formatında bilgiyi görebilirsin
});

// Layer control nesnesi
var baseMaps = {"OSM": osm};
var overlays = {};
var layerControl = L.control.layers(baseMaps, overlays).addTo(map);

// Listeye ekleme fonksiyonu
function addDataToList(id, name) {
  const dataElement = document.createElement("div");
  dataElement.innerHTML = `
  <div class="layer-name">
    ${name}
  </div>
  <span>
    <button onclick="zoomToLayer('${id}')" class="btn btn-primary btn-group">
      Zoom
    </button>
    <button onclick="removeLayer('${id}', this)" class="btn btn-danger btn-group">
      Sil
    </button>
  </span>
  `;
  document.getElementById("layer-list").appendChild(dataElement)
};

// katman listesinde ilgili katmana zoom
function zoomToLayer(id){
  const geoJsonLayer = dataList[id];
  if (geoJsonLayer){
    map.fitBounds(geoJsonLayer.getBounds());
  }
};

// katman listesinde ilgili katmanı sil
function removeLayer(id, btn){
  const geoJsonLayer = dataList[id];
  if (geoJsonLayer) {
    map.removeLayer(geoJsonLayer);
    delete dataList[id];
    layerControl.removeLayer(geoJsonLayer);
    btn.closest("div").remove();
  }
};

// Popup fonksiyonu
function createPopup(feature, layer) {
  let props = feature.properties;
  let content = "";
  for (let key in props) {
    content += key + ": " + props[key] + "<br>";
  }
  layer.bindPopup(content);
};

// Tıklandığında koordinat bilgisi versin
// var popup = L.popup();
// function onMapClick(e) {
//   popup
//     .setLatLng(e.latlng)
//     .setContent("Coordinates: " + e.latlng.toString())
//     .openOn(map);
// }
// map.on('click', onMapClick);


dataList = {}; // yüklenecek datanın id'si tutulacak
// Dosya yükleme
async function addData(data, name, type) {
  let layer;
  if (type == "geojson" || type == "shapefile") {
    layer = L.geoJSON(data, {
        onEachFeature: createPopup
    }).addTo(map);
    map.fitBounds(layer.getBounds());
  }
  else if (type == "raster"){
    layer = new GeoRasterLayer({
      georaster: data,
      opacity: 0.7,
      resolution: 256
    }).addTo(map);
    map.fitBounds(layer.getBounds());
  };
  overlays[name] = layer;
  layerControl.addOverlay(layer, name);
  const dataId = "data-" + Date.now();
  dataList[dataId] = layer;
  addDataToList(dataId, name);
};

// GeoJSON Seçme
document.getElementById("btn-geojson").onclick = () =>
  document.getElementById("geojsonFile").click();
document.getElementById("geojsonFile").addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const geojson = JSON.parse(text);
  await addData(geojson, file.name, "geojson");
  e.target.value = '';
});

// Shapefile Seçme
document.getElementById("btn-shp").onclick = () =>
  document.getElementById("zipFile").click();
document.getElementById("zipFile").addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const zip = await file.arrayBuffer();
  const shape = await shp(zip);
  await addData(shape, file.name, "shapefile");
  e.target.value = '';
});

// Raster Seçme
document.getElementById("btn-raster").onclick = () =>
  document.getElementById("rasterFile").click();
document.getElementById("rasterFile").addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const raster = await file.arrayBuffer();
  const georaster = await parseGeoraster(raster);
  await addData(georaster, file.name, "raster");
  e.target.value = '';
});