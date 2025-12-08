using Microsoft.EntityFrameworkCore;
using QCU.Backend.Data;

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// 1. ADD SERVICES TO THE CONTAINER
// ==========================================

// Add Controllers (This is the "Brain" of the API)
builder.Services.AddControllers();

// Add API Explorer and Swagger (For testing endpoints)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// --- CORS POLICY (CRITICAL) ---
// This allows your Vue.js Frontend (running on port 5173) to send requests to this Backend.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173") // Your Vue URL
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

// --- DATABASE CONNECTION ---
// Reads the "DefaultConnection" string from appsettings.json and connects to MySQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

var app = builder.Build();

// ==========================================
// 2. CONFIGURE THE HTTP REQUEST PIPELINE
// ==========================================

// Enable Swagger UI only in Development mode
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Enable CORS (Must be placed before MapControllers)
app.UseCors("AllowFrontend");

app.UseHttpsRedirection();

// --- STATIC FILES (CRITICAL FOR IMAGES) ---
// This allows the browser to load images from the 'wwwroot' folder
app.UseStaticFiles();

app.UseAuthorization();

// Connect the API routes (e.g., /api/products)
app.MapControllers();

// Start the Server
app.Run();