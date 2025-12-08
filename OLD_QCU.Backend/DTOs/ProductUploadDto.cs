using Microsoft.AspNetCore.Http;

namespace QCU.Backend.DTOs
{
    public class ProductUploadDto
    {
        public int VendorId { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public string Category { get; set; } = "Food";
        public string? Description { get; set; }
        
        public IFormFile? ImageFile { get; set; } 
    }
}