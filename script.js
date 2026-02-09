const folders = ["data", "group_1", "group_2"];
const maxDays = 31;
const mainlineBranch = `https://raw.githubusercontent.com/suddu16/cricket-fantasy/main`;
const tournament = `t20_wc_2026`

// Function to populate dropdowns for each tab
async function populateDropdowns() {
    for (const folder of folders) {
        const select = document.getElementById(`${folder}Selector`);
        let latestDay = 1;
        
        if (folder === 'data') {
            for (let i = 1; i <= maxDays; i++) { 
                const filename = `${mainlineBranch}/${tournament}/data/mvp_day_${i}.csv`;

                const option = document.createElement("option");
                option.value = filename;
                option.textContent = `Day ${i}`;
                select.appendChild(option);
            }
            
            // Find the latest available day for MVP data
            latestDay = await findLatestDay(folder, 'mvp');
            if (latestDay > 0) {
                select.selectedIndex = latestDay - 1; // Set to latest day (0-indexed)
                loadCSV('data'); // Load the data for the selected day
            }
        } else {
            for (let day = 1; day <= maxDays; day++) {
                const option = document.createElement("option");
                option.value = `${mainlineBranch}/${tournament}/${folder}/${tournament}_results_day_${day}.csv`;
                option.textContent = `Day ${day}`;
                select.appendChild(option);
            }
            const option = document.createElement("option");
            option.value = `${mainlineBranch}/${tournament}/${folder}/${tournament}_results_day_final.csv`;
            option.textContent = `Final`;
            select.appendChild(option);
            
            // Find the latest available day for group data
            latestDay = await findLatestDay(folder, 'results');
            if (latestDay > 0) {
                select.selectedIndex = latestDay - 1; // Set to latest day (0-indexed)
                loadCSV(folder); // Load the data for the selected day
            }
        }
    }
}

// Function to find the latest available day by checking file existence
async function findLatestDay(folder, type) {
    for (let day = maxDays; day >= 1; day--) {
        let filename;
        if (type === 'mvp') {
            filename = `${mainlineBranch}/${tournament}/data/mvp_day_${day}.csv`;
        } else {
            filename = `${mainlineBranch}/${tournament}/${folder}/${tournament}_results_day_${day}.csv`;
        }
        
        try {
            const response = await fetch(filename, { method: "HEAD" });
            if (response.ok) {
                return day; // Return the latest available day
            }
        } catch (error) {
            // Continue checking previous days
        }
    }
    return 1; // Default to day 1 if no files found
}

// Function to load CSV and check if it exists
async function loadCSV(folder) {
    let select, filename, messageDiv, tableDiv;

    // Set up player tabs
    if (folder === "group_1Players") {
        select = document.getElementById("group_1PlayersSelector");
        filename = select.value;
        messageDiv = document.getElementById("group_1PlayerMessage");
        tableDiv = document.getElementById("group_1PlayerTable");
    } else if (folder === "group_2Players") {
        select = document.getElementById("group_2PlayersSelector");
        filename = select.value;
        messageDiv = document.getElementById("group_2PlayerMessage");
        tableDiv = document.getElementById("group_2PlayerTable");
    } else {
        // Set up other tabs (data, group_1, group_2)
        select = document.getElementById(`${folder}Selector`);
        filename = select.value;
        messageDiv = document.getElementById(`${folder}Message`);
        tableDiv = document.getElementById(`${folder}Table`);
    }

    if (!messageDiv || !tableDiv) {
        console.error(`Error: Cannot find elements for ${folder} - messageDiv or tableDiv is null.`);
        return;
    }

    try {
        const response = await fetch(filename, { method: "HEAD" });

        if (!response.ok) throw new Error("File not found");

        messageDiv.textContent = `Loading ${filename}...`;

        // Fetch the CSV data
        const csvResponse = await fetch(filename);
        const csvText = await csvResponse.text();

        // Convert CSV text to a 2D array, filtering out empty rows
        const rows = csvText.split("\n")
            .map(row => row.split(","))
            .filter(row => row.length > 1); 

        // Clear previous table data
        tableDiv.innerHTML = "";

        // Create a table
        const table = document.createElement("table");
        table.classList.add("table", "table-striped"); // Add table styles
        table.id = `${folder}TableData`;  
        // Table header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        if (rows.length === 0) throw new Error("Empty file or invalid format");

        // Process headers based on folder type
        if (folder === "data") {
            // MVP Data - render as-is
            rows[0].forEach(field => {
                const th = document.createElement("th");
                th.textContent = field;
                headerRow.appendChild(th);
            });
        } else if (folder === "group_1Players" || folder === "group_2Players") {
            // For player groups, use the first row as header, and reverse columns for days
            const totalDays = rows[0].length - 1;
            headerRow.appendChild(createHeaderCell("Player")); // First column remains "Player"
            for (let day = totalDays; day >= 1; day--) {
                headerRow.appendChild(createHeaderCell(rows[0][day])); // Use actual day names from CSV
            }
        } else {
            // Other groups - Keep Player column, reverse the rest
            const totalDays = rows[0].length - 2;
            headerRow.appendChild(createHeaderCell("Player")); // First column remains "Player"
            for (let day = totalDays; day >= 0; day--) {
                headerRow.appendChild(createHeaderCell(`Day ${day}`));
            }
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Table body
        const tbody = document.createElement("tbody");
        var startIndex = 1
        if (folder == "group_1" || folder == "group_2") {
            startIndex = 0
        }
        rows.slice(startIndex).forEach(row => {
            const tr = document.createElement("tr");

            if (folder === "data") {
                // Render MVP data as-is
                row.forEach(cell => {
                    tr.appendChild(createCell(cell));
                });
            } else if (folder === "group_1Players" || folder === "group_2Players") {
                // For player groups, reverse the order and highlight changes
                tr.appendChild(createCell(row[0])); // Player name first
                
                // Build array of values in reverse order (most recent first)
                const values = [];
                for (let i = row.length - 1; i >= 1; i--) {
                    values.push(parseFloat(row[i]) || 0);
                }
                
                // Now iterate through values and compare with next day (which is previous chronologically)
                for (let i = 0; i < values.length; i++) {
                    const currentValue = values[i];
                    const cell = createCell(currentValue.toString());
                    
                    // For the last column (Day 1), highlight any non-zero value
                    if (i === values.length - 1) {
                        if (currentValue > 0) {
                            cell.classList.add("points-increased");
                            cell.style.backgroundColor = "#90EE90"; // Light green for positive
                            cell.style.fontWeight = "bold";
                        } else if (currentValue < 0) {
                            cell.classList.add("points-decreased");
                            cell.style.backgroundColor = "#FFB6C6"; // Light red/pink for negative
                            cell.style.fontWeight = "bold";
                        }
                    } else {
                        // Compare with the next value in array (previous day chronologically)
                        const previousDayValue = values[i + 1];
                        
                        if (currentValue !== previousDayValue) {
                            if (currentValue > previousDayValue) {
                                // Points increased
                                cell.classList.add("points-increased");
                                cell.style.backgroundColor = "#90EE90"; // Light green
                                cell.style.fontWeight = "bold";
                            } else if (currentValue < previousDayValue) {
                                // Points decreased
                                cell.classList.add("points-decreased");
                                cell.style.backgroundColor = "#FFB6C6"; // Light red/pink
                                cell.style.fontWeight = "bold";
                            }
                        }
                    }
                    
                    tr.appendChild(cell);
                }
            } else {
                // For group_1 and group_2, reverse the order for days
                tr.appendChild(createCell(row[0])); // Player name first
                for (let i = row.length - 1; i > 0; i--) {
                    tr.appendChild(createCell(row[i]));
                }
            }

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        tableDiv.appendChild(table);

        // Clear message after successful load
        messageDiv.textContent = "";

        // Initialize DataTable functionality
        const tableId = table.id;

        if (tableId.includes("dataTableData")) {
            // For MVP data
            $(table).DataTable({
                searching: true,  
                ordering: true, 
                pageLength: 20,
                info: true,
                order: [[2, "desc"]] 
            });
        } else {
            // For group_1 and group_2, sort by the last column
            $(table).DataTable({
                searching: true,  
                pageLength: 20,
                ordering: true,   
                info: true,       
                order: [[1, "desc"]] 
            });
        }

    } catch (error) {
        messageDiv.textContent = `File not found: ${filename}. Wait for it to be generated.`;
    }
}

// Helper function to create table header cells
function createHeaderCell(text) {
    const th = document.createElement("th");
    th.textContent = text;
    return th;
}

// Helper function to create table data cells
function createCell(text) {
    const td = document.createElement("td");
    td.textContent = text || "-"; // Handle empty values
    return td;
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
    await populateDropdowns();

    // Get the URL parameters
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");  // e.g., ?tab=group_1
    const dropdownParam = params.get("dropdown"); // e.g., ?dropdown=day_6

    // Activate the tab if the parameter exists
    if (tabParam) {
        const tabElement = document.querySelector(`[href="#${tabParam}"]`);
        if (tabElement) {
            const tab = new bootstrap.Tab(tabElement);
            tab.show();
            
            // Load data for the activated tab if not already loaded
            if (tabParam === 'group_1' || tabParam === 'group_2') {
                loadCSV(tabParam);
            }
        }
    }

    // Select the dropdown option if the parameter exists
    if (dropdownParam) {
        const dropdowns = document.querySelectorAll("select");
        dropdowns.forEach(select => {
            const option = select.querySelector(`option[value*="${dropdownParam}"]`);
            if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event("change")); // Trigger change event if needed
            }
        });
    }
});
