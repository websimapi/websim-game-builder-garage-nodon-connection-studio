class NodonConnectionStudio {
    constructor() {
        this.connections = [];
        this.workspaceNodons = [];
        this.connectionCount = 0;
        this.isDragging = false;
        this.isConnecting = false;
        this.connectionStart = null;
        this.tempConnection = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateConnectionCounter();
    }
    
    setupEventListeners() {
        // Drag and drop from palette
        const paletteNodons = document.querySelectorAll('.nodon-palette .nodon');
        paletteNodons.forEach(nodon => {
            nodon.addEventListener('dragstart', this.handleDragStart.bind(this));
        });
        
        // Workspace drop area
        const workspaceArea = document.getElementById('workspace-area');
        workspaceArea.addEventListener('dragover', this.handleDragOver.bind(this));
        workspaceArea.addEventListener('drop', this.handleDrop.bind(this));
        
        // Clear workspace button
        document.getElementById('clearWorkspace').addEventListener('click', this.clearWorkspace.bind(this));
        
        // Mouse events for connections
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
    
    handleDragStart(e) {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: e.target.dataset.type,
            category: this.getNodonCategory(e.target)
        }));
    }
    
    handleDragOver(e) {
        e.preventDefault();
    }
    
    handleDrop(e) {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.createWorkspaceNodon(data, x, y);
    }
    
    getNodonCategory(element) {
        const classes = element.classList;
        if (classes.contains('input-nodon')) return 'input';
        if (classes.contains('logic-nodon')) return 'logic';
        if (classes.contains('output-nodon')) return 'output';
        if (classes.contains('object-nodon')) return 'object';
        return 'unknown';
    }
    
    createWorkspaceNodon(data, x, y) {
        const workspaceArea = document.getElementById('workspace-area');
        const nodon = document.createElement('div');
        const nodonId = `nodon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        nodon.id = nodonId;
        nodon.className = `workspace-nodon ${data.category}-nodon`;
        nodon.style.left = `${Math.max(0, Math.min(x - 40, workspaceArea.clientWidth - 80))}px`;
        nodon.style.top = `${Math.max(0, Math.min(y - 40, workspaceArea.clientHeight - 80))}px`;
        
        nodon.innerHTML = `
            <div class="nodon-eye"></div>
            <span class="nodon-label">${this.capitalizeFirst(data.type)}</span>
            <div class="connection-point input-point" data-point-type="input"></div>
            <div class="connection-point output-point" data-point-type="output"></div>
        `;
        
        // Make draggable
        this.makeDraggable(nodon);
        
        // Add connection point listeners
        const connectionPoints = nodon.querySelectorAll('.connection-point');
        connectionPoints.forEach(point => {
            point.addEventListener('mousedown', this.startConnection.bind(this));
        });
        
        workspaceArea.appendChild(nodon);
        this.workspaceNodons.push({ id: nodonId, element: nodon, data });
        
        // Add entrance animation
        nodon.style.transform = 'scale(0) rotate(180deg)';
        nodon.style.opacity = '0';
        
        requestAnimationFrame(() => {
            nodon.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            nodon.style.transform = 'scale(1) rotate(0deg)';
            nodon.style.opacity = '1';
        });
    }
    
    makeDraggable(element) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        element.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('connection-point')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(element.style.left);
            startTop = parseInt(element.style.top);
            
            element.style.cursor = 'grabbing';
            element.style.zIndex = '1000';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const workspaceArea = document.getElementById('workspace-area');
            
            const newLeft = Math.max(0, Math.min(startLeft + deltaX, workspaceArea.clientWidth - 80));
            const newTop = Math.max(0, Math.min(startTop + deltaY, workspaceArea.clientHeight - 80));
            
            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
            
            this.updateConnections();
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
                element.style.zIndex = 'auto';
            }
        });
    }
    
    startConnection(e) {
        e.stopPropagation();
        this.isConnecting = true;
        this.connectionStart = {
            element: e.target.closest('.workspace-nodon'),
            point: e.target,
            type: e.target.dataset.pointType
        };
        
        // Create temporary connection line
        const svg = document.getElementById('connection-svg');
        const rect = e.target.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        
        this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempConnection.setAttribute('class', 'connection-wire temp-wire');
        this.tempConnection.setAttribute('stroke', '#ff4444');
        this.tempConnection.setAttribute('stroke-width', '2');
        this.tempConnection.setAttribute('stroke-dasharray', '5,5');
        
        svg.appendChild(this.tempConnection);
    }
    
    handleMouseMove(e) {
        if (!this.isConnecting || !this.tempConnection) return;
        
        const svg = document.getElementById('connection-svg');
        const svgRect = svg.getBoundingClientRect();
        const startRect = this.connectionStart.point.getBoundingClientRect();
        
        const startX = startRect.left + startRect.width / 2 - svgRect.left;
        const startY = startRect.top + startRect.height / 2 - svgRect.top;
        const endX = e.clientX - svgRect.left;
        const endY = e.clientY - svgRect.top;
        
        const path = this.createConnectionPath(startX, startY, endX, endY);
        this.tempConnection.setAttribute('d', path);
    }
    
    handleMouseUp(e) {
        if (!this.isConnecting) return;
        
        const target = e.target;
        if (target.classList.contains('connection-point') && 
            target !== this.connectionStart.point &&
            target.dataset.pointType !== this.connectionStart.type) {
            
            // Valid connection
            this.createConnection(this.connectionStart, {
                element: target.closest('.workspace-nodon'),
                point: target,
                type: target.dataset.pointType
            });
        }
        
        // Clean up
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
        
        this.isConnecting = false;
        this.connectionStart = null;
    }
    
    createConnection(start, end) {
        if (this.connectionCount >= 1024) {
            this.showAlert('Maximum connections reached (1024/1024)!');
            return;
        }
        
        const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const svg = document.getElementById('connection-svg');
        
        const wire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        wire.setAttribute('id', connectionId);
        wire.setAttribute('class', 'connection-wire');
        
        const connection = {
            id: connectionId,
            start,
            end,
            element: wire
        };
        
        this.connections.push(connection);
        svg.appendChild(wire);
        
        this.updateConnection(connection);
        this.connectionCount++;
        this.updateConnectionCounter();
        
        // Add sparkle effect
        this.addSparkleEffect(start.point);
        this.addSparkleEffect(end.point);
    }
    
    createConnectionPath(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const controlOffset = Math.abs(dx) * 0.5;
        
        return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
    }
    
    updateConnections() {
        this.connections.forEach(connection => {
            this.updateConnection(connection);
        });
    }
    
    updateConnection(connection) {
        const svg = document.getElementById('connection-svg');
        const svgRect = svg.getBoundingClientRect();
        
        const startRect = connection.start.point.getBoundingClientRect();
        const endRect = connection.end.point.getBoundingClientRect();
        
        const startX = startRect.left + startRect.width / 2 - svgRect.left;
        const startY = startRect.top + startRect.height / 2 - svgRect.top;
        const endX = endRect.left + endRect.width / 2 - svgRect.left;
        const endY = endRect.top + endRect.height / 2 - svgRect.top;
        
        const path = this.createConnectionPath(startX, startY, endX, endY);
        connection.element.setAttribute('d', path);
    }
    
    addSparkleEffect(element) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle-effect';
        sparkle.style.position = 'absolute';
        sparkle.style.width = '20px';
        sparkle.style.height = '20px';
        sparkle.style.background = 'radial-gradient(circle, #fff 30%, transparent 70%)';
        sparkle.style.borderRadius = '50%';
        sparkle.style.pointerEvents = 'none';
        sparkle.style.animation = 'sparkle 0.6s ease-out forwards';
        
        const rect = element.getBoundingClientRect();
        const container = element.closest('.workspace-area');
        const containerRect = container.getBoundingClientRect();
        
        sparkle.style.left = `${rect.left - containerRect.left - 10}px`;
        sparkle.style.top = `${rect.top - containerRect.top - 10}px`;
        
        container.appendChild(sparkle);
        
        setTimeout(() => sparkle.remove(), 600);
    }
    
    updateConnectionCounter() {
        document.getElementById('connectionCount').textContent = this.connectionCount;
        
        const counter = document.getElementById('connectionCount');
        if (this.connectionCount > 800) {
            counter.style.color = 'var(--input-red)';
        } else if (this.connectionCount > 500) {
            counter.style.color = 'var(--light-orange)';
        } else {
            counter.style.color = 'var(--logic-green)';
        }
    }
    
    clearWorkspace() {
        const workspaceArea = document.getElementById('workspace-area');
        const svg = document.getElementById('connection-svg');
        
        // Animate out all nodons
        this.workspaceNodons.forEach(nodon => {
            nodon.element.style.transition = 'all 0.3s ease';
            nodon.element.style.transform = 'scale(0) rotate(180deg)';
            nodon.element.style.opacity = '0';
        });
        
        setTimeout(() => {
            workspaceArea.innerHTML = '';
            svg.innerHTML = '';
            this.workspaceNodons = [];
            this.connections = [];
            this.connectionCount = 0;
            this.updateConnectionCounter();
        }, 300);
    }
    
    showAlert(message) {
        const alert = document.createElement('div');
        alert.className = 'alert-message';
        alert.textContent = message;
        alert.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--input-red);
            color: white;
            padding: 20px 30px;
            border-radius: 15px;
            font-weight: 600;
            box-shadow: 0 8px 32px var(--shadow-heavy);
            z-index: 10000;
            animation: alertPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        `;
        
        document.body.appendChild(alert);
        setTimeout(() => {
            alert.style.animation = 'alertPop 0.3s reverse';
            setTimeout(() => alert.remove(), 300);
        }, 2000);
    }
    
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes sparkle {
        0% { transform: scale(0) rotate(0deg); opacity: 1; }
        100% { transform: scale(2) rotate(180deg); opacity: 0; }
    }
    
    @keyframes alertPop {
        0% { transform: translate(-50%, -50%) scale(0); }
        70% { transform: translate(-50%, -50%) scale(1.1); }
        100% { transform: translate(-50%, -50%) scale(1); }
    }
`;
document.head.appendChild(style);

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new NodonConnectionStudio();
});

