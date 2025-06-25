// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = 'https://jlbeepzdvagdqyntpxcm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsYmVlcHpkdmFnZHF5bnRweGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NTA2MzAsImV4cCI6MjA2NjQyNjYzMH0.sYc-CniJZ598MUkrxDjCm8AsdnxByiVpldYED3s93DY';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// --- ÉLÉMENTS DU DOM ---
const parcoursListAdmin = document.getElementById('parcours-list-admin');
const form = document.getElementById('parcours-form');
const formModeInput = document.getElementById('form-mode');
const docIdInput = document.getElementById('doc-id');
const cancelEditBtn = document.getElementById('cancel-edit');
const formTitle = document.querySelector('#form-section h2');
const addLocationBtn = document.getElementById('add-location-btn');
const locationsBuilder = document.getElementById('locations-builder');

// --- VARIABLES GLOBALES ---
let allParcours = []; // On stocke les données pour la modification facile

// --- FONCTIONS ---

// Récupère et affiche tous les parcours
async function fetchAndDisplayParcours() {
    parcoursListAdmin.innerHTML = '<p>Chargement...</p>';
    
    const { data, error } = await _supabase
        .from('parcours')
        .select('*')
        .order('parcoursId', { ascending: true });

    if (error) {
        parcoursListAdmin.innerHTML = `<p class="error">Erreur: ${error.message}</p>`;
        return;
    }

    allParcours = data; // Stocke les données globalement
    parcoursListAdmin.innerHTML = ''; 
    allParcours.forEach(parcours => {
        const parcoursDiv = document.createElement('div');
        parcoursDiv.classList.add('parcours-item');
        parcoursDiv.innerHTML = `
            <span><strong>${parcours.parcoursId}:</strong> ${parcours.parcoursName} (${parcours.city})</span>
            <div>
                <button class="edit-btn" data-id="${parcours.id}">Modifier</button>
                <button class="delete-btn" data-id="${parcours.id}">Supprimer</button>
            </div>
        `;
        parcoursListAdmin.appendChild(parcoursDiv);
    });
}

// Crée et ajoute un formulaire pour un lieu
function addLocationForm(locationData = {}) {
    const locationIndex = locationsBuilder.children.length;
    const div = document.createElement('div');
    div.classList.add('location-form-group');
    div.innerHTML = `
        <div class="form-header">
            <h4>Lieu #${locationIndex + 1}</h4>
            <button type="button" class="remove-location-btn">Supprimer ce lieu</button>
        </div>
        <label>ID du Lieu (ex: L09)</label>
        <input type="text" class="location-id" value="${locationData.locationId || ''}" required>
        <label>Nom du Lieu</label>
        <input type="text" class="location-name" value="${locationData.name || ''}" required>
        <label>Coordonnées (ex: 46.21, 5.15)</label>
        <input type="text" class="location-coords" value="${(locationData.coords || []).join(', ')}" required>
        <label>Énigme / Clue</label>
        <textarea class="location-clue" rows="3">${locationData.clue || ''}</textarea>
        <label>ID de l'Objet à collecter</label>
        <input type="text" class="item-id" value="${(locationData.item || {}).id || ''}" required>
        <label>Nom de l'Objet à collecter</label>
        <input type="text" class="item-name" value="${(locationData.item || {}).name || ''}" required>
    `;
    locationsBuilder.appendChild(div);
}

// Remplit le formulaire principal pour la modification
function populateFormForEdit(docId) {
    const parcoursToEdit = allParcours.find(p => p.id === docId);
    if (!parcoursToEdit) return;

    formTitle.textContent = "Modifier un Parcours";
    formModeInput.value = 'edit';
    docIdInput.value = parcoursToEdit.id;
    document.getElementById('parcoursId').value = parcoursToEdit.parcoursId;
    document.getElementById('parcoursName').value = parcoursToEdit.parcoursName;
    document.getElementById('city').value = parcoursToEdit.city;
    document.getElementById('isFinal').checked = parcoursToEdit.isFinal;
    
    locationsBuilder.innerHTML = '';
    parcoursToEdit.locations.forEach(location => {
        addLocationForm(location);
    });

    cancelEditBtn.classList.remove('hidden');
    window.scrollTo(0, 0);
}

// Réinitialise le formulaire en mode "Ajout"
function resetForm() {
    formTitle.textContent = "Ajouter un Parcours";
    form.reset();
    formModeInput.value = 'add';
    docIdInput.value = '';
    locationsBuilder.innerHTML = '';
    cancelEditBtn.classList.add('hidden');
}

// --- GESTION DES ÉVÉNEMENTS ---

// Gère les clics sur "Modifier" et "Supprimer"
parcoursListAdmin.addEventListener('click', async (event) => {
    const target = event.target;
    if (!target.dataset.id) return;
    const docId = parseInt(target.dataset.id, 10);

    if (target.classList.contains('delete-btn')) {
        if (confirm("Êtes-vous sûr de vouloir supprimer ce parcours ? Cette action est irréversible.")) {
            const { error } = await _supabase.from('parcours').delete().eq('id', docId);
            if (error) alert(`Erreur lors de la suppression : ${error.message}`);
            else {
                alert('Parcours supprimé !');
                fetchAndDisplayParcours();
            }
        }
    }

    if (target.classList.contains('edit-btn')) {
        populateFormForEdit(docId);
    }
});

// Gère l'ajout d'un nouveau bloc "Lieu"
addLocationBtn.addEventListener('click', () => {
    addLocationForm();
});

// Gère la suppression d'un bloc "Lieu"
locationsBuilder.addEventListener('click', (event) => {
    if (event.target.classList.contains('remove-location-btn')) {
        event.target.closest('.location-form-group').remove();
    }
});

// Gère la soumission du formulaire (Ajout OU Modification)
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const locationsArray = [];
    const locationForms = locationsBuilder.querySelectorAll('.location-form-group');

    for (const formGroup of locationForms) {
        const coordsString = formGroup.querySelector('.location-coords').value;
        const coords = coordsString.split(',').map(coord => parseFloat(coord.trim()));

        if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
            alert("Format de coordonnées invalide dans l'un des lieux. Utilisez 'latitude, longitude'. Exemple : 46.21, 5.15");
            return; // Stoppe la soumission
        }

        const locationData = {
            locationId: formGroup.querySelector('.location-id').value,
            name: formGroup.querySelector('.location-name').value,
            coords: coords,
            clue: formGroup.querySelector('.location-clue').value,
            item: {
                id: formGroup.querySelector('.item-id').value,
                name: formGroup.querySelector('.item-name').value
            }
        };
        locationsArray.push(locationData);
    }

    const parcoursData = {
        parcoursId: document.getElementById('parcoursId').value,
        parcoursName: document.getElementById('parcoursName').value,
        city: document.getElementById('city').value,
        isFinal: document.getElementById('isFinal').checked,
        locations: locationsArray
    };

    const mode = formModeInput.value;
    let error;

    if (mode === 'edit') {
        const docId = parseInt(docIdInput.value, 10);
        ({ error } = await _supabase.from('parcours').update(parcoursData).eq('id', docId));
    } else {
        ({ error } = await _supabase.from('parcours').insert([parcoursData]));
    }

    if (error) {
        alert(`Erreur lors de l'enregistrement : ${error.message}`);
    } else {
        alert('Parcours enregistré avec succès !');
        resetForm();
        fetchAndDisplayParcours();
    }
});

// Gère le clic sur le bouton "Annuler la modification"
cancelEditBtn.addEventListener('click', () => {
    resetForm();
});

// --- INITIALISATION DE LA PAGE ---
fetchAndDisplayParcours();