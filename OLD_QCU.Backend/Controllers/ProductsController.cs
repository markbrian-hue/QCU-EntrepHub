using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QCU.Backend.Data;
using QCU.Backend.Models;
using QCU.Backend.DTOs; // Make sure to have this using

namespace QCU.Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductsController : ControllerBase
    {
        private readonly AppDbContext _context;
        // We need this environment variable to find the folder path on the server
        private readonly IWebHostEnvironment _environment;

        // Update constructor to inject IWebHostEnvironment
        public ProductsController(AppDbContext context, IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
        {
            return await _context.Products.Include(p => p.Vendor).ToListAsync();
        }

        [HttpGet("vendor/{vendorId}")]
        public async Task<ActionResult<IEnumerable<Product>>> GetVendorProducts(int vendorId)
        {
            return await _context.Products
                .Where(p => p.VendorId == vendorId)
                .OrderByDescending(p => p.ProductId)
                .ToListAsync();
        }

       // POST: api/products
[HttpPost]
public async Task<IActionResult> PostProduct([FromForm] ProductUploadDto dto) // <--- MUST BE [FromForm]
{
    try
    {
        // DEBUG LOGGING
        Console.WriteLine($"[DEBUG] Received Upload: Name={dto.Name}, VendorID={dto.VendorId}");

        if (dto.VendorId <= 0) 
        {
            return BadRequest($"Invalid Vendor ID: {dto.VendorId}. Ensure your frontend is sending 'VendorId'.");
        }

        var vendorExists = await _context.Vendors.AnyAsync(v => v.VendorId == dto.VendorId);
        if (!vendorExists) 
        {
            return BadRequest($"Vendor ID {dto.VendorId} does not exist in the database.");
        }

        // HANDLE IMAGE
        string imageUrl = "";
        if (dto.ImageFile != null && dto.ImageFile.Length > 0)
        {
            string uploadsFolder = Path.Combine(_environment.WebRootPath, "images");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            string uniqueFileName = Guid.NewGuid().ToString() + "_" + dto.ImageFile.FileName;
            string filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await dto.ImageFile.CopyToAsync(fileStream);
            }

            imageUrl = $"{Request.Scheme}://{Request.Host}/images/{uniqueFileName}";
        }

        // SAVE TO DB
        var newProduct = new Product
        {
            VendorId = dto.VendorId,
            Name = dto.Name,
            Price = dto.Price,
            StockQuantity = dto.StockQuantity,
            Category = dto.Category,
            Description = dto.Description,
            ImageUrl = imageUrl
        };

        _context.Products.Add(newProduct);
        await _context.SaveChangesAsync();

        return CreatedAtAction("GetProducts", new { id = newProduct.ProductId }, newProduct);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[CRITICAL ERROR] {ex.Message}");
        return StatusCode(500, $"Server Error: {ex.Message}");
    }
}
    }
}