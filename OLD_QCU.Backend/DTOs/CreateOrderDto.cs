namespace QCU.Backend.DTOs
{
    // This represents ONE item in the cart
    public class OrderItemDto
    {
        public int ProductId { get; set; }
        public int Quantity { get; set; }
    }

    // This represents the entire Checkout Form
    public class CreateOrderDto
    {
        public int CustomerUserId { get; set; } // The ID of the student buying
        public int VendorId { get; set; }       // The ID of the shop (e.g., Truffle Kings)
        public string DeliveryLocation { get; set; } = string.Empty; // "Room 305"
        public string PaymentMethod { get; set; } = "GCASH";
        
        // A list of items they are buying
        public List<OrderItemDto> Items { get; set; } = new List<OrderItemDto>();
    }
}