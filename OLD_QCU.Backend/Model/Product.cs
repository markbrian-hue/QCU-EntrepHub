using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace QCU.Backend.Models
{
    public class Product
    {
        [Key]
        public int ProductId { get; set; }

        public int VendorId { get; set; }

        [ForeignKey("VendorId")]
        public Vendor? Vendor { get; set; } 

        // Add '?' to ALL strings to prevent "DBNull" crashes
        public string? Name { get; set; } 
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public string? Category { get; set; } 
        public string? ImageUrl { get; set; }
        public string? Description { get; set; }
    }
}