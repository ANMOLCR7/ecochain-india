// EcoChain India Frontend Script
// All code runs after DOMContentLoaded

document.addEventListener('DOMContentLoaded', () => {
    // --- Config ---
    const API_BASE_URL = 'http://localhost:5000/api';

    // --- Section Elements ---
const sections = {
    dashboard: document.getElementById('dashboard-section'),
    regulations: document.getElementById('regulations-section'),
    vendors: document.getElementById('vendors-section'),
        reports: document.getElementById('reports-section'),
    brsr: document.getElementById('brsr-section')
};

    // --- Navigation ---
document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
        e.preventDefault();
        const section = link.getAttribute('data-section');
            Object.values(sections).forEach(sec => sec.classList.remove('active'));
            if (sections[section]) sections[section].classList.add('active');
            document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
        link.classList.add('active');
        // Load data for section
            if (section === 'dashboard') loadDashboard();
        if (section === 'regulations') loadRegulations();
        if (section === 'vendors') loadVendors();
    });
});

    // --- Download Report Button ---
    const downloadBtn = document.getElementById('download-report');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/reports/download`, { method: 'GET' });
                if (!response.ok) throw new Error('Failed to download report');
                const blob = await response.blob();
                // Try to extract filename from Content-Disposition header
                let filename = 'compliance_report.html';
                const disposition = response.headers.get('Content-Disposition');
                if (disposition && disposition.indexOf('filename=') !== -1) {
                    filename = disposition.split('filename=')[1].replace(/"/g, '');
                }
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (err) {
                alert('Error downloading report: ' + err.message);
            }
        });
    }

    // --- Schedule Demo Button ---
    const scheduleBtn = document.getElementById('schedule-demo');
    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', async () => {
            const email = prompt('Enter your email to schedule a demo:');
            if (email) {
                try {
                    const response = await fetch(`${API_BASE_URL}/demo/schedule`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    if (!response.ok) throw new Error('Failed to schedule demo');
                    alert('Demo scheduled! We will contact you soon.');
                } catch (err) {
                    alert('Error scheduling demo: ' + err.message);
                }
            }
        });
    }

    // --- Dashboard ---
async function loadDashboard() {
    try {
            const [regRes, venRes] = await Promise.all([
            fetch(`${API_BASE_URL}/regulations`),
            fetch(`${API_BASE_URL}/vendors`)
        ]);
            const regulations = await regRes.json();
            const vendors = await venRes.json();
        document.getElementById('regulation-count').textContent = regulations.length;
        document.getElementById('vendor-count').textContent = vendors.length;
            // Avg score (robust)
            const validScores = vendors
                .map(v => Number(v.compliance_score))
                .filter(score => !isNaN(score));
            const avg = validScores.length
                ? (validScores.reduce((s, v) => s + v, 0) / validScores.length).toFixed(1)
                : 0;
            document.getElementById('avg-score').textContent = `${avg}%`;
            // At risk
            const risk = vendors.filter(v => Number(v.compliance_score) < 60).length;
            document.getElementById('risk-count').textContent = risk;
            // Deadlines
        const deadlinesContainer = document.getElementById('deadlines-container');
            const sorted = [...regulations].sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 3);
            deadlinesContainer.innerHTML = sorted.map(reg => {
                const diff = Math.ceil((new Date(reg.deadline) - new Date()) / (1000*60*60*24));
                let priority = '';
                if (diff < 30) priority = 'list-group-item-danger';
                else if (diff < 90) priority = 'list-group-item-warning';
                return `<a href="#" class="list-group-item list-group-item-action ${priority}">
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1">${reg.title}</h5>
                        <small class="text-${diff < 90 ? 'danger' : 'muted'}">${reg.deadline}</small>
                    </div>
                    <p class="mb-1">${reg.ministry}</p>
                    <small class="text-${diff < 90 ? 'danger' : 'muted'}">
                        <i class="fas fa-${diff < 30 ? 'exclamation-triangle' : 'calendar'}"></i> 
                        ${diff < 30 ? 'High Priority' : diff < 90 ? 'Medium Priority' : `${diff} days remaining`}
                    </small>
                </a>`;
            }).join('');
            // Compliance Trend
            renderComplianceTrend(vendors);
            // Compliance by State
            renderStateCompliance(vendors);
        } catch (err) {
            document.getElementById('deadlines-container').innerHTML = `<div class="alert alert-danger">Failed to load deadlines: ${err.message}</div>`;
        }
    }

    // --- Compliance Trend Chart (real data, 0 if no data) ---
    function renderComplianceTrend(vendors) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        const trendLabels = [];
        const trendData = [];
        // Prepare 6 months buckets
        const buckets = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            buckets.push({
                label: `${months[d.getMonth()]} ${d.getFullYear()}`,
                year: d.getFullYear(),
                month: d.getMonth(),
                scores: []
            });
        }
        // Assign vendor scores to buckets based on last_audit
        vendors.forEach(v => {
            if (!v.last_audit) return;
            const auditDate = new Date(v.last_audit);
            buckets.forEach(bucket => {
                if (
                    auditDate.getFullYear() === bucket.year &&
                    auditDate.getMonth() === bucket.month
                ) {
                    bucket.scores.push(Number(v.compliance_score) || 0);
                }
            });
        });
        // Calculate average for each bucket
        buckets.forEach(bucket => {
            trendLabels.push(bucket.label);
            if (bucket.scores.length > 0) {
                const avg = bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length;
                trendData.push(Number(avg.toFixed(1)));
            } else {
                trendData.push(0); // Show 0 if no data for this month
            }
        });
        // Destroy previous chart if exists
        if (window.complianceChartInstance) {
            window.complianceChartInstance.destroy();
        }
        const ctx = document.getElementById('complianceChart').getContext('2d');
        window.complianceChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendLabels,
                datasets: [{
                    label: 'Avg. Compliance Score',
                    data: trendData,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40,167,69,0.1)',
                    fill: true,
                    tension: 0.3,
                    spanGaps: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { min: 0, max: 100, title: { display: true, text: 'Score (%)' } }
                }
            }
        });
    }

    // --- Compliance by State (dynamic, real data) ---
    function renderStateCompliance(vendors) {
        // Get all unique states from vendor data
        const stateSet = new Set();
        vendors.forEach(v => {
            if (v.state) stateSet.add(v.state);
        });
        const states = Array.from(stateSet);
        const stateData = {};
        states.forEach(state => {
            stateData[state] = [];
        });
        // Group compliance scores by state
        vendors.forEach(v => {
            if (v.state && !isNaN(Number(v.compliance_score))) {
                stateData[v.state].push(Number(v.compliance_score));
            }
        });
        // Build HTML for each state
        let html = '';
        states.forEach(state => {
            const scores = stateData[state];
            const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0) : 0;
            let barClass = 'bg-success';
            if (avg < 80) barClass = 'bg-info';
            if (avg < 60) barClass = 'bg-warning';
            if (avg < 45) barClass = 'bg-danger';
            html += `
                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <span>${state}</span>
                        <span>${avg}%</span>
                    </div>
                    <div class="progress">
                        <div class="progress-bar ${barClass}" style="width: ${avg}%"></div>
                    </div>
                </div>
            `;
        });
        // Update the dashboard
        const container = document.querySelector('.state-compliance-card .card-body');
        if (container) container.innerHTML = html;
    }

    // --- Regulations ---
async function loadRegulations() {
    try {
            const res = await fetch(`${API_BASE_URL}/regulations`);
            const regs = await res.json();
            const table = document.getElementById('regulations-table');
            table.innerHTML = regs.map(reg => {
                const applicable = Array.isArray(reg.applicable_to) ? reg.applicable_to.join(', ') : (reg.applicable_to || '');
                return `<tr>
                    <td>${reg.id}</td>
                    <td>${reg.title}</td>
                    <td><span class="badge ${reg.regulation_type === 'Central' ? 'bg-primary' : 'bg-info'}">${reg.regulation_type}</span></td>
                    <td>${reg.deadline}</td>
                    <td>${applicable}</td>
                    <td>${reg.status || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-reg" data-id="${reg.id}"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-outline-success edit-reg" data-id="${reg.id}"><i class="fas fa-edit"></i></button>
                    </td>
                </tr>`;
        }).join('');
            document.querySelectorAll('.view-reg').forEach(btn => btn.onclick = () => viewRegulation(btn.dataset.id));
            document.querySelectorAll('.edit-reg').forEach(btn => btn.onclick = () => editRegulation(btn.dataset.id));
        } catch (err) {
            document.getElementById('regulations-table').innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load regulations: ${err.message}</td></tr>`;
        }
    }
async function viewRegulation(id) {
    try {
            const res = await fetch(`${API_BASE_URL}/regulations/${id}`);
            const reg = await res.json();
            alert(`Regulation Details:\nID: ${reg.id}\nTitle: ${reg.title}\nType: ${reg.regulation_type}\nMinistry: ${reg.ministry}\nDeadline: ${reg.deadline}\nDescription: ${reg.description}`);
        } catch (err) {
        alert('Failed to load regulation details');
    }
}
function editRegulation(id) {
    alert(`Edit functionality for regulation ${id} would go here`);
    }
    document.getElementById('show-reg-form').onclick = () => {
        document.getElementById('regulation-form').classList.toggle('d-none');
    };
    const cancelRegBtn = document.getElementById('cancel-reg-form');
    if (cancelRegBtn) cancelRegBtn.onclick = () => {
        document.getElementById('regulation-form').classList.add('d-none');
    };
    const addRegForm = document.getElementById('add-regulation-form');
    if (addRegForm) addRegForm.onsubmit = async e => {
        e.preventDefault();
        const form = e.target;
        const data = {
            title: form.querySelector('input[type="text"]').value,
            regulation_type: form.querySelector('select').value,
            ministry: form.querySelectorAll('input[type="text"]')[1].value,
            deadline: form.querySelector('input[type="date"]').value,
            applicable_to: form.querySelectorAll('input[type="text"]')[2].value.split(',').map(s => s.trim()),
            description: form.querySelector('textarea').value
        };
        try {
            const res = await fetch(`${API_BASE_URL}/regulations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to add regulation');
            alert('Regulation added successfully!');
            form.reset();
            document.getElementById('regulation-form').classList.add('d-none');
            loadRegulations();
            loadDashboard();
        } catch (err) {
            alert('Failed to add regulation: ' + err.message);
        }
    };

    // --- Vendors ---
    // Store all vendors for filtering
    window.allVendors = [];

    // Helper: Render vendor table from a list
    function renderVendorsTable(vendors) {
        const table = document.getElementById('vendors-table');
        table.innerHTML = vendors.map(v => {
            let scoreClass = 'bg-success';
            if (v.compliance_score < 80) scoreClass = 'bg-warning';
            if (v.compliance_score < 60) scoreClass = 'bg-danger';
            return `<tr>
                <td>${v.id}</td>
                <td>${v.company_name}</td>
                <td>${v.industry}</td>
                <td>${v.state}</td>
                <td><span class="badge ${scoreClass}">${v.compliance_score}%</span></td>
                <td><span class="badge ${v.brsr_compliance ? 'bg-success' : 'bg-danger'}">${v.brsr_compliance ? 'Compliant' : 'Non-Compliant'}</span></td>
                <td>${v.status || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-vendor" data-id="${v.id}"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline-warning update-vendor" data-id="${v.id}"><i class="fas fa-chart-line"></i></button>
                    <button class="btn btn-sm btn-outline-info check-compliance" data-id="${v.id}"><i class="fas fa-clipboard-check"></i></button>
                    </td>
            </tr>`;
        }).join('');
        document.querySelectorAll('.view-vendor').forEach(btn => btn.onclick = () => viewVendor(btn.dataset.id));
        document.querySelectorAll('.update-vendor').forEach(btn => btn.onclick = () => updateVendorScore(btn.dataset.id));
        document.querySelectorAll('.check-compliance').forEach(btn => btn.onclick = () => checkVendorCompliance(btn.dataset.id));
    }

    // Filtering logic
    function filterVendors() {
        const search = document.getElementById('vendor-search').value.trim().toLowerCase();
        const industry = document.getElementById('industry-filter').value;
        const state = document.getElementById('state-filter').value;
        let filtered = window.allVendors;
        if (search) {
            filtered = filtered.filter(v =>
                v.company_name.toLowerCase().includes(search) ||
                (v.industry && v.industry.toLowerCase().includes(search)) ||
                (v.state && v.state.toLowerCase().includes(search))
            );
        }
        if (industry && industry !== 'All Industries') {
            filtered = filtered.filter(v => v.industry === industry);
        }
        if (state && state !== 'All States') {
            filtered = filtered.filter(v => v.state === state);
        }
        renderVendorsTable(filtered);
    }

    // Attach filter event listeners
    const vendorSearch = document.getElementById('vendor-search');
    const industryFilter = document.getElementById('industry-filter');
    const stateFilter = document.getElementById('state-filter');
    if (vendorSearch) vendorSearch.addEventListener('input', filterVendors);
    if (industryFilter) industryFilter.addEventListener('change', filterVendors);
    if (stateFilter) stateFilter.addEventListener('change', filterVendors);

    // Update loadVendors to use allVendors and filtering
    async function loadVendors() {
        try {
            const res = await fetch(`${API_BASE_URL}/vendors`);
            const vendors = await res.json();
            window.allVendors = vendors; // Store for filtering
            filterVendors(); // Initial render with all vendors
            // Populate vendor select for BRSR
        const vendorSelect = document.getElementById('vendor-select');
            if (vendorSelect) {
                vendorSelect.innerHTML = vendors.map(v => `<option value="${v.id}">${v.company_name}</option>`).join('');
            }
        } catch (err) {
            document.getElementById('vendors-table').innerHTML = `<tr><td colspan="8" class="text-center text-danger">Failed to load vendors: ${err.message}</td></tr>`;
        }
    }
async function viewVendor(id) {
    try {
            const res = await fetch(`${API_BASE_URL}/vendors/${id}`);
            const v = await res.json();
            alert(`Vendor Details:\nID: ${v.id}\nCompany: ${v.company_name}\nCIN: ${v.cin || 'N/A'}\nGSTIN: ${v.gstin || 'N/A'}\nIndustry: ${v.industry}\nState: ${v.state}\nCompliance Score: ${v.compliance_score}%\nBRSR Compliance: ${v.brsr_compliance ? 'Yes' : 'No'}\nLast Audit: ${v.last_audit || 'Never'}`);
        } catch (err) {
        alert('Failed to load vendor details');
    }
}
async function updateVendorScore(id) {
    const newScore = prompt('Enter new compliance score for vendor ' + id + ':', '75.0');
    if (newScore !== null && !isNaN(newScore)) {
        try {
            const response = await fetch(`${API_BASE_URL}/vendors/${id}/compliance`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ compliance_score: parseFloat(newScore) })
            });
            if (!response.ok) throw new Error('Failed to update compliance score');
            const result = await response.json();
            alert(`Vendor ${id} compliance score updated to ${newScore}%`);
            loadVendors(); // Refresh the vendor list
            loadDashboard(); // Refresh dashboard stats
        } catch (err) {
            alert('Error updating compliance score: ' + err.message);
        }
    }
}
    document.getElementById('show-vendor-form').onclick = () => {
        document.getElementById('vendor-form').classList.toggle('d-none');
    };
    const cancelVendorBtn = document.getElementById('cancel-vendor-form');
    if (cancelVendorBtn) cancelVendorBtn.onclick = () => {
        document.getElementById('vendor-form').classList.add('d-none');
    };
    const addVendorForm = document.getElementById('add-vendor-form');
    if (addVendorForm) addVendorForm.onsubmit = async e => {
        e.preventDefault();
        const form = e.target;
        const brsrVal = form.querySelector('input[name="brsr"]:checked').value;
        const data = {
            company_name: form.querySelector('input[type="text"]').value,
            industry: form.querySelectorAll('select')[0].value,
            state: form.querySelectorAll('select')[1].value,
            compliance_score: parseFloat(form.querySelector('input[type="number"]').value),
            brsr_compliance: brsrVal === 'yes',
            cin: '',
            gstin: ''
        };
        try {
            const res = await fetch(`${API_BASE_URL}/vendors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to add vendor');
            alert('Vendor added successfully!');
            form.reset();
            document.getElementById('vendor-form').classList.add('d-none');
            loadVendors();
            loadDashboard();
        } catch (err) {
            alert('Failed to add vendor: ' + err.message);
        }
    };

    // --- BRSR Section: Populate Vendor Dropdown Dynamically ---
async function populateBRSRVendorDropdown() {
    try {
        const vendorSelect = document.getElementById('vendor-select');
        if (vendorSelect) {
            // Show loading state
            vendorSelect.innerHTML = '<option value="">Loading vendors...</option>';
            
            const res = await fetch(`${API_BASE_URL}/vendors`);
            const vendors = await res.json();
            
            if (vendors.length > 0) {
                vendorSelect.innerHTML = `
                    <option value="">Select a vendor...</option>
                    ${vendors.map(v => `<option value="${v.id}">${v.company_name} (${v.compliance_score}% compliance)</option>`).join('')}
                `;
            } else {
                vendorSelect.innerHTML = '<option value="">No vendors available</option>';
            }
        }
    } catch (err) {
        const vendorSelect = document.getElementById('vendor-select');
        if (vendorSelect) {
            vendorSelect.innerHTML = '<option value="">Error loading vendors</option>';
        }
        console.error('Failed to populate vendor dropdown:', err);
    }
}

// --- BRSR Section: Check Compliance ---
const checkBRSRBtn = document.getElementById('check-brsr');
if (checkBRSRBtn) checkBRSRBtn.onclick = async () => {
    const vendorId = document.getElementById('vendor-select').value;
    const detailsDiv = document.getElementById('compliance-details');
    const resultDiv = document.getElementById('brsr-result');
    
    try {
        // Get vendor details and BRSR compliance data
        const [vendorRes, brsrRes] = await Promise.all([
            fetch(`${API_BASE_URL}/vendors/${vendorId}`),
            fetch(`${API_BASE_URL}/regulations/brsr/${vendorId}`)
        ]);
        
        if (!vendorRes.ok || !brsrRes.ok) throw new Error('Failed to fetch compliance data');
        
        const vendor = await vendorRes.json();
        const brsrData = await brsrRes.json();
        
        // Calculate ESG scores based on vendor data
        const environmentalScore = Math.min(100, vendor.compliance_score + (vendor.brsr_compliance ? 5 : -10));
        const socialScore = Math.min(100, vendor.compliance_score + (vendor.brsr_compliance ? 3 : -5));
        const governanceScore = Math.min(100, vendor.compliance_score + (vendor.brsr_compliance ? 7 : -15));
        const overallScore = Math.round((environmentalScore + socialScore + governanceScore) / 3);
        
        // Update the compliance status section with real data
        const complianceStatusSection = document.querySelector('#brsr-section .card-body');
        if (complianceStatusSection) {
            complianceStatusSection.innerHTML = `
                <div class="row mb-4">
                    <div class="col-md-4 text-center">
                        <div class="display-4 fw-bold ${overallScore >= 80 ? 'text-success' : overallScore >= 60 ? 'text-warning' : 'text-danger'}">${overallScore}%</div>
                        <div class="text-muted">Overall Score</div>
                        <small class="text-muted">${vendor.company_name}</small>
                    </div>
                    <div class="col-md-8">
                        <div class="mb-3">
                            <div class="d-flex justify-content-between mb-1">
                                <span>Environmental Compliance</span>
                                <span>${environmentalScore}%</span>
                            </div>
                            <div class="progress">
                                <div class="progress-bar ${environmentalScore >= 80 ? 'bg-success' : environmentalScore >= 60 ? 'bg-warning' : 'bg-danger'}" style="width: ${environmentalScore}%"></div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <div class="d-flex justify-content-between mb-1">
                                <span>Social Responsibility</span>
                                <span>${socialScore}%</span>
                            </div>
                            <div class="progress">
                                <div class="progress-bar ${socialScore >= 80 ? 'bg-success' : socialScore >= 60 ? 'bg-warning' : 'bg-danger'}" style="width: ${socialScore}%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="d-flex justify-content-between mb-1">
                                <span>Governance</span>
                                <span>${governanceScore}%</span>
                            </div>
                            <div class="progress">
                                <div class="progress-bar ${governanceScore >= 80 ? 'bg-success' : governanceScore >= 60 ? 'bg-warning' : 'bg-danger'}" style="width: ${governanceScore}%"></div>
                            </div>
                    </div>
                    </div>
                </div>
                
                <div class="alert ${brsrData.brsrRequired ? 'alert-success' : 'alert-warning'}">
                    <i class="fas fa-${brsrData.brsrRequired ? 'check-circle' : 'exclamation-triangle'} me-2"></i>
                    ${brsrData.message}
            </div>
            
                <div class="row mt-3">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                                <h6 class="card-title">BRSR Status</h6>
                                <p class="card-text">
                                    <span class="badge ${brsrData.brsrRequired ? 'bg-success' : 'bg-warning'}">
                                        ${brsrData.brsrRequired ? 'Required' : 'Not Required'}
                                    </span>
                                </p>
                                <small class="text-muted">Last Reported: ${brsrData.lastReported || 'Not Available'}</small>
                            </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                                <h6 class="card-title">Next Deadline</h6>
                                <p class="card-text text-danger">${brsrData.nextDeadline}</p>
                                <small class="text-muted">SEBI BRSR Reporting</small>
                            </div>
                    </div>
                </div>
            </div>
            
            <div class="mt-4">
                    <h6>Required Actions:</h6>
                    <ul class="list-unstyled">
                        <li><i class="fas fa-check-circle text-success me-2"></i>Submit BRSR report before deadline</li>
                        <li><i class="fas fa-check-circle text-success me-2"></i>Conduct ESG audit for all facilities</li>
                        <li><i class="fas fa-check-circle text-success me-2"></i>Implement sustainability training program</li>
                        ${brsrData.brsrRequired ? '<li><i class="fas fa-exclamation-triangle text-warning me-2"></i>Address compliance gaps immediately</li>' : ''}
                        ${overallScore < 60 ? '<li><i class="fas fa-exclamation-triangle text-danger me-2"></i>Improve overall compliance score</li>' : ''}
                </ul>
            </div>
        `;
        }
        
    } catch (err) {
        const complianceStatusSection = document.querySelector('#brsr-section .card-body');
        if (complianceStatusSection) {
            complianceStatusSection.innerHTML = `
            <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to check BRSR compliance: ${err.message}
            </div>
        `;
        }
    }
};

// --- Enhanced Vendor Compliance Check ---
async function checkVendorCompliance(vendorId) {
    try {
        const [vendorRes, regulationsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/vendors/${vendorId}`),
            fetch(`${API_BASE_URL}/regulations`)
        ]);
        
        if (!vendorRes.ok || !regulationsRes.ok) throw new Error('Failed to fetch data');
        
        const vendor = await vendorRes.json();
        const regulations = await regulationsRes.json();
        
        // Calculate compliance metrics
        const complianceMetrics = {
            overallScore: vendor.compliance_score,
            brsrStatus: vendor.brsr_compliance ? 'Compliant' : 'Non-Compliant',
            riskLevel: vendor.compliance_score >= 80 ? 'Low' : vendor.compliance_score >= 60 ? 'Medium' : 'High',
            lastAudit: vendor.last_audit || 'Never',
            applicableRegulations: regulations.filter(r => 
                r.applicable_to && 
                (Array.isArray(r.applicable_to) ? r.applicable_to.includes(vendor.industry) : r.applicable_to.includes(vendor.industry))
            ).length,
            upcomingDeadlines: regulations.filter(r => {
                const deadline = new Date(r.deadline);
                const now = new Date();
                const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
                return diffDays > 0 && diffDays <= 90;
            }).length
        };
        
        // Show comprehensive compliance report
        const report = `
Vendor Compliance Report
=======================

Company: ${vendor.company_name}
Industry: ${vendor.industry}
State: ${vendor.state}

Compliance Metrics:
- Overall Score: ${complianceMetrics.overallScore}%
- Risk Level: ${complianceMetrics.riskLevel}
- BRSR Status: ${complianceMetrics.brsrStatus}
- Last Audit: ${complianceMetrics.lastAudit}
- Applicable Regulations: ${complianceMetrics.applicableRegulations}
- Upcoming Deadlines: ${complianceMetrics.upcomingDeadlines}

Recommendations:
${complianceMetrics.overallScore < 60 ? '- Immediate action required to improve compliance score' : ''}
${complianceMetrics.upcomingDeadlines > 0 ? '- Monitor upcoming regulatory deadlines' : ''}
${!vendor.brsr_compliance ? '- BRSR compliance needs attention' : ''}
${complianceMetrics.lastAudit === 'Never' ? '- Schedule compliance audit' : ''}
        `;
        
        alert(report);
        
    } catch (err) {
        alert('Error checking vendor compliance: ' + err.message);
    }
}

// --- When BRSR section is shown, populate vendor dropdown ---
document.querySelector('.nav-link[data-section="brsr"]').addEventListener('click', populateBRSRVendorDropdown);

    // --- Reports Section: Generate Report Buttons ---
document.querySelectorAll('#reports-section .btn-outline-success, #reports-section .btn-outline-info, #reports-section .btn-outline-warning').forEach((btn, idx) => {
    btn.addEventListener('click', async () => {
        // Map button index to report type
        const types = ['regulatory', 'vendor', 'brsr'];
        const type = types[idx] || 'regulatory';
        try {
            const response = await fetch(`${API_BASE_URL}/reports/download?type=${type}`, { method: 'GET' });
            if (!response.ok) throw new Error('Failed to download report');
            const blob = await response.blob();
            // Try to extract filename from Content-Disposition header
                                    let filename = `${type}_report.html`;
            const disposition = response.headers.get('Content-Disposition');
            if (disposition && disposition.indexOf('filename=') !== -1) {
                filename = disposition.split('filename=')[1].replace(/"/g, '');
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Error downloading report: ' + err.message);
        }
    });
});

// --- Reports Section: Recent Reports (Real Data) ---
async function loadRecentReports() {
    try {
        const res = await fetch(`${API_BASE_URL}/reports/recent`);
        if (!res.ok) throw new Error('Failed to fetch recent reports');
        const reports = await res.json();
        const list = document.querySelector('#reports-section .list-group');
        if (list && reports.length > 0) {
            list.innerHTML = reports.map(r => `
                <a href="#" class="list-group-item list-group-item-action" data-id="${r.id}" data-type="${r.type}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${r.title}</h6>
                        <small class="text-muted">${r.generatedAgo}</small>
                    </div>
                    <p class="mb-1">${r.description}</p>
                    <small class="text-muted">
                        <i class="fas fa-${r.type === 'regulatory' ? 'file-contract' : r.type === 'vendor' ? 'building' : 'clipboard-check'} me-1"></i>
                        Generated by: ${r.generatedBy}
                    </small>
                </a>
            `).join('');
            // Download on click
            list.querySelectorAll('a[data-id]').forEach(a => {
                a.addEventListener('click', async (e) => {
    e.preventDefault();
                    const id = a.getAttribute('data-id');
                    const type = a.getAttribute('data-type');
                    try {
                        const response = await fetch(`${API_BASE_URL}/reports/download?id=${id}`, { method: 'GET' });
                        if (!response.ok) throw new Error('Failed to download report');
                        const blob = await response.blob();
                        let filename = `report_${id}.html`;
                        const disposition = response.headers.get('Content-Disposition');
                        if (disposition && disposition.indexOf('filename=') !== -1) {
                            filename = disposition.split('filename=')[1].replace(/"/g, '');
                        }
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                    } catch (err) {
                        alert('Error downloading report: ' + err.message);
                    }
                });
            });
        } else if (list) {
            list.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-file-alt fa-3x mb-3"></i>
                    <p>No recent reports available</p>
                    <small>Reports will appear here as they are generated</small>
                </div>
            `;
        }
    } catch (err) {
        const list = document.querySelector('#reports-section .list-group');
        if (list) {
            list.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load recent reports: ${err.message}
                </div>
            `;
        }
    }
}

// --- Reports Section: Load Report Statistics ---
async function loadReportStats() {
    try {
        const res = await fetch(`${API_BASE_URL}/reports/stats`);
        if (!res.ok) throw new Error('Failed to fetch report statistics');
        const stats = await res.json();
        
        // Update report cards with real data
        const regulatoryCard = document.querySelector('#reports-section .col-md-4:nth-child(1) .card-body');
        const vendorCard = document.querySelector('#reports-section .col-md-4:nth-child(2) .card-body');
        const brsrCard = document.querySelector('#reports-section .col-md-4:nth-child(3) .card-body');
        
        if (regulatoryCard) {
            const p = regulatoryCard.querySelector('p');
            if (p) p.textContent = `${stats.totalRegulations} regulations tracked, ${stats.upcomingDeadlines} upcoming deadlines`;
        }
        
        if (vendorCard) {
            const p = vendorCard.querySelector('p');
            if (p) p.textContent = `${stats.totalVendors} vendors, ${stats.avgComplianceScore}% avg compliance`;
        }
        
        if (brsrCard) {
            const p = brsrCard.querySelector('p');
            if (p) p.textContent = `${stats.brsrCompliant}/${stats.totalVendors} vendors BRSR compliant`;
        }
    } catch (err) {
        console.error('Failed to load report stats:', err);
    }
}

// Call this when the Reports section is shown
document.querySelector('.nav-link[data-section="reports"]').addEventListener('click', () => {
    loadRecentReports();
    loadReportStats();
});

    // --- Initial Load ---
    loadDashboard();
    loadVendors();
    loadReportStats(); // Load report statistics on initial load

    // --- System Check ---
    function checkSystem() {
        console.log('EcoChain India Frontend - System Check');
        console.log('API Base URL:', API_BASE_URL);
        console.log('Sections loaded:', Object.keys(sections).filter(key => sections[key] !== null).length);
        console.log('Navigation links:', document.querySelectorAll('.nav-link').length);
        console.log('System ready:', true);
    }
    checkSystem();
});
