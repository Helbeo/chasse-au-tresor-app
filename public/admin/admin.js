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

    parcoursListAdmin.innerHTML = ''; // Vide la liste
    data.forEach(parcours => {
        const parcoursDiv = document.createElement('div');
        parcoursDiv.classList.add('parcours-item');
        parcoursDiv.innerHTML = `
            <strong>${parcours.parcoursId}: ${parcours.parcoursName}</strong> (${parcours.city})
            <div>
                <button class="edit-btn" data-id="${parcours.id}">Modifier</button>
                <button class="delete-btn" data-id="${parcours.id}">Supprimer</button>
            </div>
        `;
        parcoursListAdmin.appendChild(parcoursDiv);
    });
}


// Gère la soumission du formulaire (Ajout ou Modification)
form.addEventListener('submit', async (event) => {
    event.preventDefault(); // Empêche le rechargement de la page

    // 1. Récupérer les données du formulaire
    const parcoursData = {
        parcoursId: document.getElementById('parcoursId').value,
        parcoursName: document.getElementById('parcoursName').value,
        city: document.getElementById('city').value,
        isFinal: document.getElementById('isFinal').checked,
        locations: JSON.parse(document.getElementById('locations').value) // Attention, doit être du JSON valide !
    };

    // 2. Envoyer à Supabase
    const { data, error } = await _supabase
        .from('parcours')
        .insert([parcoursData]);

    if (error) {
        alert(`Erreur lors de l'enregistrement : ${error.message}`);
    } else {
        alert('Parcours enregistré avec succès !');
        form.reset(); // Vide le formulaire
        fetchAndDisplayParcours(); // Met à jour la liste
    }
});


// --- INITIALISATION DE LA PAGE ---
// Affiche les parcours au chargement
fetchAndDisplayParcours();