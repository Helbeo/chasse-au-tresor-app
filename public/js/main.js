// --- CONFIGURATION ---
const AIN_COORDINATES = [46.15, 5.34];
const INITIAL_ZOOM_LEVEL = 9;
const COLLECTION_RADIUS_METERS = 99999999999999999999999999999999999;

// NOUVEAU : Configuration et initialisation de Supabase
const SUPABASE_URL = 'https://jlbeepzdvagdqyntpxcm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsYmVlcHpkdmFnZHF5bnRweGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NTA2MzAsImV4cCI6MjA2NjQyNjYzMH0.sYc-CniJZ598MUkrxDjCm8AsdnxByiVpldYED3s93DY'; // Collez votre clé 'anon' 'public' ici

// Initialise Supabase
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- VARIABLES GLOBALES ---
let map;
let playerMarker;
let allParcoursData = []; // Stocke tous les parcours chargés du JSON
let activeParcoursId = null; // ID du parcours actuellement affiché
let markersLayer = L.featureGroup(); // Utilise featureGroup pour avoir .getBounds()
let playerState = {
    collectedItems: [],
    completedParcours: []
};

// --- INITIALISATION DE L'APPLICATION ---
document.addEventListener('DOMContentLoaded', async () => {
    loadProgress();
    initMap();
    await loadData();
    displayParcoursList();
    // Affiche le premier parcours non terminé ou le premier de la liste
    const firstParcours = allParcoursData.find(p => !p.isFinal && !playerState.completedParcours.includes(p.parcoursId)) || allParcoursData.find(p => !p.isFinal);
    if (firstParcours) {
        displayParcours(firstParcours.parcoursId);
    }
    startGeolocation();
    updateUI();
});

// --- GESTION DE LA PROGRESSION ---
function saveProgress() {
    localStorage.setItem('playerState', JSON.stringify(playerState));
}

function loadProgress() {
    const savedState = localStorage.getItem('playerState');
    if (savedState) {
        playerState = JSON.parse(savedState);
    }
}

// --- GESTION DE LA CARTE ET DES DONNÉES ---
function initMap() {
    map = L.map('map').setView(AIN_COORDINATES, INITIAL_ZOOM_LEVEL);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    markersLayer.addTo(map);
    map.on('dragstart', () => { 
        map.closePopup(); 
    });
}

async function loadData() {
    try {
        // On interroge la table "parcours" dans Supabase
        // .select('*') signifie qu'on veut toutes les colonnes
        const { data, error } = await _supabase.from('parcours').select('*');

        // S'il y a une erreur, on l'affiche et on arrête
        if (error) {
            throw error;
        }

        // Si tout va bien, on met les données dans notre variable
        allParcoursData = data;

        console.log("Données chargées avec succès depuis Supabase !", allParcoursData);

    } catch (error) {
        // La console affichera ici le message d'erreur s'il y en a un
        console.error("ERREUR : Impossible de charger les données depuis Supabase :", error.message);
    }
}

// --- AFFICHAGE ET LOGIQUE DES PARCOURS ---
function displayParcoursList() {
    const listElement = document.getElementById('parcours-list');
    listElement.innerHTML = '';

    const normalParcours = allParcoursData.filter(p => !p.isFinal);
    const finalParcours = allParcoursData.find(p => p.isFinal);

    // Affiche les parcours normaux
    normalParcours.forEach(parcours => {
        const li = createParcoursListItem(parcours, false);
        listElement.appendChild(li);
    });

    // Gère l'affichage du parcours final
    if (finalParcours) {
        const allNormalCompleted = normalParcours.length > 0 && normalParcours.every(p => playerState.completedParcours.includes(p.parcoursId));
        const isLocked = !allNormalCompleted;
        const li = createParcoursListItem(finalParcours, isLocked);
        listElement.appendChild(li);
    }
}

function createParcoursListItem(parcours, isLocked = false) {
    const li = document.createElement('li');
    li.dataset.parcoursId = parcours.parcoursId;

    if (parcours.isFinal) {
        li.textContent = `🏆 ${parcours.parcoursName}`;
    } else {
        li.textContent = `📍 ${parcours.city}`;
    }

    if (isLocked) {
        li.classList.add('locked');
        li.title = "Terminez tous les autres parcours pour débloquer celui-ci !";
    } else {
        li.onclick = () => displayParcours(parcours.parcoursId);
        if (playerState.completedParcours.includes(parcours.parcoursId)) {
            li.classList.add('completed');
        }
        if (parcours.parcoursId === activeParcoursId) {
            li.classList.add('active');
        }
    }
    return li;
}

function displayParcours(parcoursId) {
    activeParcoursId = parcoursId;
    const parcours = allParcoursData.find(p => p.parcoursId === parcoursId);
    if (!parcours) return;

    markersLayer.clearLayers();

    parcours.locations.forEach(location => {
        const marker = L.marker(location.coords);
        marker.locationData = location;
        const isCollected = playerState.collectedItems.find(item => item.id === location.item.id);
        if (isCollected) {
            marker.setOpacity(0.6);
        }
        const popupContent = `<b>${location.name}</b><p>${location.clue}</p><button class="collect-btn" data-location-id="${location.locationId}">Chargement...</button>`;
        marker.bindPopup(popupContent, { autoPan: false });
        marker.on('popupopen', () => updatePopupButton(marker));
        markersLayer.addLayer(marker);
    });

    if (parcours.locations.length > 0) {
        map.fitBounds(markersLayer.getBounds().pad(0.5));
    }
    
    displayParcoursList();
    updateUI();
}

// --- GÉOLOCALISATION ET INTERACTION ---
function startGeolocation() {
    if (!navigator.geolocation) {
        alert("La géolocalisation n'est pas supportée par votre navigateur.");
        return;
    }
    const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, geoOptions);
}

// Trouvez cette fonction dans votre main.js
function onLocationSuccess(position) {
    const { latitude, longitude } = position.coords;
    const playerPosition = [latitude, longitude];

    if (!playerMarker) {
        // Cette section s'exécute une seule fois, au premier signal GPS
        playerMarker = L.marker(playerPosition).addTo(map);
        playerMarker.bindPopup("C'est vous !");
        
        
    } else {
        // Met à jour la position pour les signaux suivants
        playerMarker.setLatLng(playerPosition);
    }
}
function onLocationError(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            alert("Vous avez refusé l'accès à votre position. La chasse au trésor ne peut pas fonctionner.");
            break;
        case error.POSITION_UNAVAILABLE:
            alert("Information de position non disponible.");
            break;
        case error.TIMEOUT:
            alert("La demande de position a expiré.");
            break;
        default:
            alert("Une erreur inconnue est survenue.");
            break;
    }
}

function updatePopupButton(marker) {
    const popupElement = marker.getPopup().getElement();
    if (!popupElement) return;
    const collectButton = popupElement.querySelector('.collect-btn');
    if (!playerMarker) {
        collectButton.textContent = "Position non trouvée";
        collectButton.disabled = true;
        return;
    }
    const isAlreadyCollected = playerState.collectedItems.find(item => item.id === marker.locationData.item.id);
    if (isAlreadyCollected) {
        collectButton.disabled = true;
        collectButton.textContent = "Récupéré !";
        return;
    }
    const playerLatLng = playerMarker.getLatLng();
    const distance = playerLatLng.distanceTo(marker.getLatLng());
    if (distance <= COLLECTION_RADIUS_METERS) {
        collectButton.disabled = false;
        collectButton.textContent = `Récupérer ${marker.locationData.item.name}`;
        if (!collectButton.onclick) {
            collectButton.onclick = () => onCollectItem(marker);
        }
    } else {
        collectButton.disabled = true;
        collectButton.textContent = "Rapprochez-vous !";
    }
}

function onCollectItem(marker) {
    const locationData = marker.locationData;
    if (playerState.collectedItems.find(item => item.id === locationData.item.id)) return;
    alert(`Bravo ! Vous avez trouvé : ${locationData.item.name} !`);
    playerState.collectedItems.push(locationData.item);
    updatePopupButton(marker);
    marker.setOpacity(0.6);
    updateUI();
    saveProgress();
}

// --- INTERFACE UTILISATEUR (PANNEAU DU BAS) ---
function updateUI() {
    const inventoryList = document.getElementById('inventory-list');
    inventoryList.innerHTML = '';
    if (playerState.collectedItems.length === 0) {
        inventoryList.innerHTML = `<li>Votre sac est vide...</li>`;
    } else {
        playerState.collectedItems.forEach(item => {
            inventoryList.innerHTML += `<li>🔑 ${item.name}</li>`;
        });
    }

    const currentParcours = allParcoursData.find(p => p.parcoursId === activeParcoursId);
    if (!currentParcours) {
        document.getElementById('quest-title').textContent = "Aucun parcours sélectionné";
        document.getElementById('quest-progress').textContent = "";
        return;
    }

    const questTitle = document.getElementById('quest-title');
    const questProgress = document.getElementById('quest-progress');
    questTitle.textContent = currentParcours.parcoursName;

    const itemsForThisParcours = currentParcours.locations.map(loc => loc.item.id);
    const collectedForThisParcours = playerState.collectedItems.filter(item => itemsForThisParcours.includes(item.id));
    
    questProgress.textContent = `${collectedForThisParcours.length} / ${currentParcours.locations.length} objets trouvés`;

    if (collectedForThisParcours.length === currentParcours.locations.length && !playerState.completedParcours.includes(currentParcours.parcoursId)) {
        playerState.completedParcours.push(currentParcours.parcoursId);
        displayParcoursList();
        saveProgress();
        setTimeout(() => alert(`Félicitations ! Vous avez terminé le parcours : ${currentParcours.parcoursName} !`), 500);
    }
}