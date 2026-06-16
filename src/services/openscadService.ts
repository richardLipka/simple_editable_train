
/**
 * Generates OpenSCAD code for a train carriage.
 * This code is suitable for Makerworld Customizer.
 */
export const generateOpenSCAD = (carriageType: string, emoji: string) => {
  return `
/*
 [ Train Logic Express - Parametric Carriage ]
 
 This model is a customizable train carriage designed for 3D printing.
 It features adjustable dimensions, wheel placement, and cargo types.
 
 Compatible with Makerworld / Bambu Lab Customizer.
 Generated for: ${carriageType} (${emoji})
*/

/* [ Carriage Dimensions ] */

// Total length of the carriage body
carriage_length = 40; // [20:100]

// Total width of the carriage body
carriage_width = 25; // [15:50]

// Height of the main chassis
base_height = 6; // [2:15]

// Corner radius for the chassis
chassis_radius = 2; // [0:5]

/* [ Wheels ] */

// Diameter of the wheels
wheel_diameter = 10; // [5:20]

// Thickness of each wheel
wheel_thickness = 3; // [1:10]

// Distance from the ends of the carriage to the wheel axles
wheel_offset_x = 8; // [5:30]

/* [ Cargo ] */

// Type of cargo to display on top
cargo_style = "box"; // [none, box, cylinder, sphere]

// Size of the cargo object
cargo_size = 15; // [5:30]

/* [ Appearance ] */

// Main color of the carriage
carriage_color = "SteelBlue"; // [Red, Green, Blue, SteelBlue, Orange, DarkSlateGray]

// Color of the wheels
wheel_color = "DimGray"; // [Black, DimGray, Silver]

// --- Internal Variables ---
$fn = 64; // Smoothness of curves

// --- Modules ---

module chassis() {
    color(carriage_color)
    linear_extrude(height = base_height, center = true)
    offset(r = chassis_radius)
    square([carriage_length - chassis_radius*2, carriage_width - chassis_radius*2], center = true);
}

module wheel() {
    color(wheel_color)
    rotate([90, 0, 0])
    cylinder(h = wheel_thickness, d = wheel_diameter, center = true);
}

module wheel_set() {
    x_pos = carriage_length / 2 - wheel_offset_x;
    y_pos = carriage_width / 2 + wheel_thickness / 2;
    z_pos = -base_height / 4;
    
    translate([x_pos, y_pos, z_pos]) wheel();
    translate([-x_pos, y_pos, z_pos]) wheel();
    translate([x_pos, -y_pos, z_pos]) wheel();
    translate([-x_pos, -y_pos, z_pos]) wheel();
}

module cargo() {
    color("Goldenrod")
    translate([0, 0, base_height/2 + cargo_size/2])
    if (cargo_style == "box") {
        cube(cargo_size, center = true);
    } else if (cargo_style == "cylinder") {
        cylinder(h = cargo_size, d = cargo_size, center = true);
    } else if (cargo_style == "sphere") {
        sphere(d = cargo_size);
    }
}

module coupling() {
    color("Silver")
    for (dir = [-1, 1]) {
        translate([dir * (carriage_length/2 + 2), 0, -base_height/4])
        cube([6, 4, 2], center = true);
    }
}

// --- Final Assembly ---

union() {
    chassis();
    wheel_set();
    if (cargo_style != "none") {
        cargo();
    }
    coupling();
}

// Model Info: ${carriageType}
`;
};
