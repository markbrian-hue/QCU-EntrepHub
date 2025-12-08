using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace QCU.Backend.Models
{
    public class Vendor
    {
        [Key]
        public int VendorId { get; set; }
        public int UserId { get; set; } 
        
        public string ShopName { get; set; } = string.Empty;
        
        // ADD '?' TO THESE LINES so they don't crash on NULL database values
        public string? CourseSection { get; set; }
        public bool IsOpen { get; set; } = false;
        public string? GcashNumber { get; set; }
        public string? ShopDescription { get; set; }
    }
}